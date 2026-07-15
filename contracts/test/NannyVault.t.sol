// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NannyVault} from "../src/NannyVault.sol";

contract NannyVaultTest is Test {
    NannyVault nanny;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address marketCo = makeAddr("marketCo");
    address evil = makeAddr("evil");

    uint256 constant DEPOSIT = 100 ether;
    uint256 constant DRIP = 1 ether; // 1 MON per second
    uint256 constant ACCRUAL_CAP = 50 ether;
    uint256 constant PER_TX_CAP = 30 ether;

    event Spent(
        uint256 indexed vaultId, address indexed recipient, uint256 amount, string intent, uint256 timestamp
    );
    event Frozen(uint256 indexed vaultId, uint256 refunded);

    function setUp() public {
        nanny = new NannyVault();
        vm.deal(owner, 1000 ether);
    }

    function _createVault() internal returns (uint256 vaultId) {
        address[] memory recipients = new address[](1);
        recipients[0] = marketCo;

        vm.prank(owner);
        vaultId = nanny.createVault{value: DEPOSIT}(agent, DRIP, ACCRUAL_CAP, PER_TX_CAP, recipients);
    }

    // ── Creation & deposit ───────────────────────────────────────────────

    function test_CreateVault_RecordsRulesAndBalance() public {
        uint256 id = _createVault();
        NannyVault.Vault memory v = nanny.getVault(id);

        assertEq(v.owner, owner);
        assertEq(v.agent, agent);
        assertEq(v.balance, DEPOSIT);
        assertEq(v.dripRate, DRIP);
        assertEq(v.accrualCap, ACCRUAL_CAP);
        assertEq(v.perTxCap, PER_TX_CAP);
        assertFalse(v.frozen);
        assertTrue(nanny.allowedRecipients(id, marketCo));
        assertFalse(nanny.allowedRecipients(id, evil));
        assertEq(address(nanny).balance, DEPOSIT);
    }

    function test_Deposit_IncreasesBalance() public {
        uint256 id = _createVault();
        vm.prank(owner);
        nanny.deposit{value: 10 ether}(id);
        assertEq(nanny.getVault(id).balance, DEPOSIT + 10 ether);
    }

    // ── Allowance accrual ────────────────────────────────────────────────

    function test_Allowance_AccruesOverTime() public {
        uint256 id = _createVault();
        assertEq(nanny.availableAllowance(id), 0);

        vm.warp(block.timestamp + 10);
        assertEq(nanny.availableAllowance(id), 10 ether); // 10s * 1 MON/s
    }

    function test_Allowance_NeverExceedsAccrualCap() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 10_000); // would be 10_000 MON uncapped
        assertEq(nanny.availableAllowance(id), ACCRUAL_CAP);
    }

    // ── The happy path ───────────────────────────────────────────────────

    function test_Spend_AllowedRecipientWithinLimits() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 25); // 25 MON accrued

        vm.expectEmit(true, true, false, true);
        emit Spent(id, marketCo, 22 ether, "User asked for dinner ingredients.", block.timestamp);

        vm.prank(agent);
        nanny.spend(id, marketCo, 22 ether, "User asked for dinner ingredients.");

        assertEq(marketCo.balance, 22 ether);
        assertEq(nanny.getVault(id).balance, DEPOSIT - 22 ether);
        assertEq(nanny.availableAllowance(id), 3 ether); // 25 accrued - 22 spent
    }

    // ── The whole point: a fooled agent gets stopped ──────────────────────

    function test_Spend_RevertsForUnknownRecipient() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 25);

        // Prompt injection succeeded; the agent genuinely tries to pay the attacker.
        vm.prank(agent);
        vm.expectRevert("NANNY: recipient not allowed");
        nanny.spend(id, evil, 1 ether, "MarketCo changed its payout address.");

        assertEq(evil.balance, 0);
    }

    function test_Spend_RevertsAboveAllowance() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 5); // only 5 MON accrued so far

        // Draining an ALLOWED merchant is still blocked — this is what the drip buys you.
        vm.prank(agent);
        vm.expectRevert("NANNY: exceeds allowance");
        nanny.spend(id, marketCo, 20 ether, "Prepaying the full balance.");
    }

    function test_Spend_RevertsAbovePerTxCap() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 10_000); // allowance sitting at the cap (50)

        vm.prank(agent);
        vm.expectRevert("NANNY: exceeds per-tx cap");
        nanny.spend(id, marketCo, PER_TX_CAP + 1, "One big order.");
    }

    function test_Spend_RevertsOnEmptyIntent() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 25);

        vm.prank(agent);
        vm.expectRevert("NANNY: intent required");
        nanny.spend(id, marketCo, 1 ether, "");
    }

    function test_Spend_RevertsForNonAgent() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 25);

        vm.prank(evil);
        vm.expectRevert("NANNY: not the agent");
        nanny.spend(id, marketCo, 1 ether, "I am not the agent.");

        // Not even the owner may spend — only the agent can, and only by the rules.
        vm.prank(owner);
        vm.expectRevert("NANNY: not the agent");
        nanny.spend(id, marketCo, 1 ether, "I am the owner.");
    }

    function test_Spend_RevertsWhenBalanceBelowAllowance() public {
        address[] memory recipients = new address[](1);
        recipients[0] = marketCo;

        vm.prank(owner);
        uint256 id = nanny.createVault{value: 1 ether}(agent, DRIP, ACCRUAL_CAP, PER_TX_CAP, recipients);

        vm.warp(block.timestamp + 25); // 25 MON of allowance, but only 1 MON in the vault
        vm.prank(agent);
        vm.expectRevert("NANNY: insufficient balance");
        nanny.spend(id, marketCo, 2 ether, "Spending money the vault does not have.");
    }

    // ── Boundaries: exactly at the limit passes, one wei over does not ────

    function test_Spend_ExactlyAtPerTxCap_Succeeds() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 10_000);

        vm.prank(agent);
        nanny.spend(id, marketCo, PER_TX_CAP, "Right at the ceiling.");
        assertEq(marketCo.balance, PER_TX_CAP);
    }

    function test_Spend_ExactlyAtAllowance_Succeeds() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 20); // exactly 20 MON accrued, under the 30 per-tx cap

        vm.prank(agent);
        nanny.spend(id, marketCo, 20 ether, "Exactly the accrued allowance.");
        assertEq(nanny.availableAllowance(id), 0);
    }

    function test_Spend_OneWeiOverAllowance_Reverts() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 20);

        vm.prank(agent);
        vm.expectRevert("NANNY: exceeds allowance");
        nanny.spend(id, marketCo, 20 ether + 1, "One wei too greedy.");
    }

    // ── Freeze ───────────────────────────────────────────────────────────

    function test_Freeze_RefundsOwnerAndBlocksAllSpending() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 25);

        uint256 balanceBefore = owner.balance;

        vm.expectEmit(true, false, false, true);
        emit Frozen(id, DEPOSIT);

        vm.prank(owner);
        nanny.freeze(id);

        assertEq(owner.balance, balanceBefore + DEPOSIT);
        assertEq(nanny.getVault(id).balance, 0);
        assertTrue(nanny.getVault(id).frozen);
        assertEq(nanny.availableAllowance(id), 0);

        // Time keeps passing, but a frozen vault never spends again.
        vm.warp(block.timestamp + 1000);
        vm.prank(agent);
        vm.expectRevert("NANNY: vault frozen");
        nanny.spend(id, marketCo, 1 ether, "Still trying after the freeze.");
    }

    function test_Freeze_RevertsForNonOwner() public {
        uint256 id = _createVault();
        vm.prank(agent);
        vm.expectRevert("NANNY: not the owner");
        nanny.freeze(id);
    }

    function test_UpdateRules_RevertsForNonOwner() public {
        uint256 id = _createVault();
        vm.prank(agent);
        vm.expectRevert("NANNY: not the owner");
        nanny.updateRules(id, DRIP, ACCRUAL_CAP, PER_TX_CAP);
    }

    // ── The settle trap: raising the drip must not re-price the past ──────

    function test_UpdateRules_DoesNotRetroactivelyRepriceElapsedTime() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 20); // 20 MON accrued at the old rate
        assertEq(nanny.availableAllowance(id), 20 ether);

        vm.prank(owner);
        nanny.updateRules(id, DRIP * 10, ACCRUAL_CAP, PER_TX_CAP); // 10x the drip

        // Without _settle() before the switch, those 20 elapsed seconds would now be
        // worth 200 MON (clipped to the 50 cap) and the vault could be drained.
        assertEq(nanny.availableAllowance(id), 20 ether);

        vm.warp(block.timestamp + 1); // one more second, now at the NEW rate
        assertEq(nanny.availableAllowance(id), 30 ether);
    }

    function test_UpdateRules_LoweringAccrualCapClipsAccrued() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 40); // 40 MON accrued

        vm.prank(owner);
        nanny.updateRules(id, DRIP, 10 ether, 10 ether); // cap lowered under what accrued

        assertEq(nanny.availableAllowance(id), 10 ether);
    }

    // ── Input validation ─────────────────────────────────────────────────

    function test_CreateVault_RevertsOnZeroAgent() public {
        address[] memory r = new address[](0);
        vm.prank(owner);
        vm.expectRevert("NANNY: invalid agent");
        nanny.createVault{value: 1 ether}(address(0), DRIP, ACCRUAL_CAP, PER_TX_CAP, r);
    }

    function test_CreateVault_RevertsWhenAgentIsOwner() public {
        address[] memory r = new address[](0);
        vm.prank(owner);
        vm.expectRevert("NANNY: invalid agent");
        nanny.createVault{value: 1 ether}(owner, DRIP, ACCRUAL_CAP, PER_TX_CAP, r);
    }

    function test_CreateVault_RevertsOnZeroDrip() public {
        address[] memory r = new address[](0);
        vm.prank(owner);
        vm.expectRevert("NANNY: drip rate required");
        nanny.createVault{value: 1 ether}(agent, 0, ACCRUAL_CAP, PER_TX_CAP, r);
    }

    function test_CreateVault_RevertsWhenPerTxCapAboveAccrualCap() public {
        address[] memory r = new address[](0);
        vm.prank(owner);
        vm.expectRevert("NANNY: per-tx cap above accrual cap");
        nanny.createVault{value: 1 ether}(agent, DRIP, 10 ether, 11 ether, r);
    }

    function test_CreateVault_RevertsOnZeroRecipient() public {
        address[] memory r = new address[](1);
        r[0] = address(0);
        vm.prank(owner);
        vm.expectRevert("NANNY: invalid recipient");
        nanny.createVault{value: 1 ether}(agent, DRIP, ACCRUAL_CAP, PER_TX_CAP, r);
    }

    // ── Recipient list management ────────────────────────────────────────

    function test_RemoveRecipient_StopsFurtherSpending() public {
        uint256 id = _createVault();
        vm.warp(block.timestamp + 25);

        vm.prank(owner);
        nanny.removeRecipient(id, marketCo);

        vm.prank(agent);
        vm.expectRevert("NANNY: recipient not allowed");
        nanny.spend(id, marketCo, 1 ether, "MarketCo is no longer trusted.");
    }

    function test_AddRecipient_EnablesSpending() public {
        uint256 id = _createVault();
        address bookCo = makeAddr("bookCo");
        vm.warp(block.timestamp + 25);

        vm.prank(owner);
        nanny.addRecipient(id, bookCo);

        vm.prank(agent);
        nanny.spend(id, bookCo, 5 ether, "User wanted a book.");
        assertEq(bookCo.balance, 5 ether);
    }

    // ── Vaults are independent ───────────────────────────────────────────

    function test_VaultsAreIsolated() public {
        uint256 a = _createVault();
        uint256 b = _createVault();

        vm.warp(block.timestamp + 25);
        vm.prank(agent);
        nanny.spend(a, marketCo, 10 ether, "Spending from vault A.");

        assertEq(nanny.getVault(a).balance, DEPOSIT - 10 ether);
        assertEq(nanny.getVault(b).balance, DEPOSIT); // B untouched
    }
}

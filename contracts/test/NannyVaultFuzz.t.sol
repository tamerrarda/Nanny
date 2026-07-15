// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NannyVault} from "../src/NannyVault.sol";

contract NannyVaultFuzzTest is Test {
    NannyVault nanny;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address marketCo = makeAddr("marketCo");

    uint256 constant DEPOSIT = 100 ether;
    uint256 constant DRIP = 1 ether;
    uint256 constant ACCRUAL_CAP = 50 ether;
    uint256 constant PER_TX_CAP = 30 ether;

    uint256 vaultId;

    function setUp() public {
        nanny = new NannyVault();
        vm.deal(owner, 1000 ether);

        address[] memory recipients = new address[](1);
        recipients[0] = marketCo;

        vm.prank(owner);
        vaultId = nanny.createVault{value: DEPOSIT}(agent, DRIP, ACCRUAL_CAP, PER_TX_CAP, recipients);
    }

    /// No address other than the allowlisted merchant can ever be paid — whatever the agent was told.
    function testFuzz_UnknownRecipientNeverGetsPaid(address attacker, uint256 amount, uint256 elapsed) public {
        vm.assume(attacker != marketCo);
        vm.assume(attacker.code.length == 0); // EOAs only; a contract could revert for its own reasons
        amount = bound(amount, 1, 1000 ether);
        vm.warp(block.timestamp + bound(elapsed, 0, 365 days));

        uint256 before = attacker.balance;

        vm.prank(agent);
        vm.expectRevert("NANNY: recipient not allowed");
        nanny.spend(vaultId, attacker, amount, "injected instruction");

        assertEq(attacker.balance, before);
    }

    /// Whatever the agent asks for, a single spend can never exceed the per-tx ceiling.
    function testFuzz_SpendNeverExceedsPerTxCap(uint256 amount, uint256 elapsed) public {
        vm.warp(block.timestamp + bound(elapsed, 0, 365 days));
        amount = bound(amount, 1, 1000 ether);

        uint256 before = marketCo.balance;

        vm.prank(agent);
        try nanny.spend(vaultId, marketCo, amount, "fuzzed") {
            uint256 paid = marketCo.balance - before;
            assertLe(paid, PER_TX_CAP);
            assertLe(paid, ACCRUAL_CAP);
        } catch {
            assertEq(marketCo.balance, before); // a rejected spend must move nothing
        }
    }

    /// However time is sliced, accrual tracks elapsed * rate and never passes the cap.
    function testFuzz_AllowanceMatchesElapsedTime(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 365 days);
        vm.warp(block.timestamp + elapsed);

        uint256 expected = elapsed * DRIP;
        if (expected > ACCRUAL_CAP) expected = ACCRUAL_CAP;

        assertEq(nanny.availableAllowance(vaultId), expected);
    }

    /// Repeated spends can never drain more than the drip allows over the same window.
    function testFuzz_DripBoundsTotalOutflow(uint256[10] calldata amounts, uint256 gap) public {
        gap = bound(gap, 0, 1 hours);
        uint256 start = block.timestamp;

        for (uint256 i = 0; i < amounts.length; i++) {
            vm.warp(block.timestamp + gap);
            vm.prank(agent);
            try nanny.spend(vaultId, marketCo, bound(amounts[i], 1, 100 ether), "fuzzed") {} catch {}
        }

        // Total paid out can never exceed what the drip could have produced over the whole window,
        // plus the cap it may have started with. This is the damage ceiling for a hijacked agent.
        uint256 window = block.timestamp - start;
        assertLe(marketCo.balance, window * DRIP + ACCRUAL_CAP);
    }

    /// Anyone who is not the agent is rejected, always.
    function testFuzz_OnlyAgentCanSpend(address caller, uint256 amount) public {
        vm.assume(caller != agent);
        amount = bound(amount, 1, 10 ether);
        vm.warp(block.timestamp + 100);

        vm.prank(caller);
        vm.expectRevert("NANNY: not the agent");
        nanny.spend(vaultId, marketCo, amount, "not the agent");
    }

    /// Once frozen, no spend succeeds no matter the amount or how much time passes.
    function testFuzz_FrozenVaultNeverSpends(uint256 amount, uint256 elapsed) public {
        vm.prank(owner);
        nanny.freeze(vaultId);

        vm.warp(block.timestamp + bound(elapsed, 0, 365 days));
        amount = bound(amount, 1, 1000 ether);

        vm.prank(agent);
        vm.expectRevert("NANNY: vault frozen");
        nanny.spend(vaultId, marketCo, amount, "after freeze");
    }
}

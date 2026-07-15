// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NannyVault} from "../src/NannyVault.sol";

/// @dev Drives the vault the way the real world would: a hostile agent hammering `spend`
///      with arbitrary recipients and amounts, an owner poking the rules, and time moving.
contract VaultHandler is Test {
    NannyVault public nanny;
    uint256 public vaultId;

    address public owner;
    address public agent;
    address public marketCo;

    uint256 public totalSpent;
    uint256 public totalRefunded;
    uint256 public totalDeposited;

    constructor(NannyVault _nanny, uint256 _vaultId, address _owner, address _agent, address _marketCo) {
        nanny = _nanny;
        vaultId = _vaultId;
        owner = _owner;
        agent = _agent;
        marketCo = _marketCo;
        totalDeposited = _nanny.getVault(_vaultId).balance;
    }

    function spend(uint256 amount, uint256 recipientSeed, uint256 timeJump) external {
        vm.warp(block.timestamp + bound(timeJump, 0, 3 days));

        // Half the time the agent aims at the allowed merchant, half the time at a random address
        // (i.e. it has been prompt-injected). Both paths must respect the rules.
        address recipient = recipientSeed % 2 == 0 ? marketCo : address(uint160(bound(recipientSeed, 1, type(uint160).max)));
        amount = bound(amount, 0, 200 ether);

        uint256 before = nanny.getVault(vaultId).balance;

        vm.prank(agent);
        try nanny.spend(vaultId, recipient, amount, "fuzzed intent") {
            totalSpent += before - nanny.getVault(vaultId).balance;
        } catch {}
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 0, 10 ether);
        vm.deal(owner, amount);
        vm.prank(owner);
        try nanny.deposit{value: amount}(vaultId) {
            totalDeposited += amount;
        } catch {}
    }

    function updateRules(uint256 drip, uint256 accrualCap, uint256 perTxCap, uint256 timeJump) external {
        vm.warp(block.timestamp + bound(timeJump, 0, 1 days));
        drip = bound(drip, 1, 100 ether);
        accrualCap = bound(accrualCap, 1, 500 ether);
        perTxCap = bound(perTxCap, 1, accrualCap);

        vm.prank(owner);
        try nanny.updateRules(vaultId, drip, accrualCap, perTxCap) {} catch {}
    }

    function freeze() external {
        uint256 before = nanny.getVault(vaultId).balance;
        vm.prank(owner);
        try nanny.freeze(vaultId) {
            totalRefunded += before;
        } catch {}
    }
}

contract NannyVaultInvariantTest is Test {
    NannyVault nanny;
    VaultHandler handler;
    uint256 vaultId;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address marketCo = makeAddr("marketCo");

    function setUp() public {
        nanny = new NannyVault();
        vm.deal(owner, 1000 ether);

        address[] memory recipients = new address[](1);
        recipients[0] = marketCo;

        vm.prank(owner);
        vaultId = nanny.createVault{value: 100 ether}(agent, 1 ether, 50 ether, 30 ether, recipients);

        handler = new VaultHandler(nanny, vaultId, owner, agent, marketCo);
        targetContract(address(handler));

        // The fuzzer funds whatever address it picks as msg.sender. If it picks the agent,
        // the agent ends up holding ETH that never came from the vault — which would make
        // invariant_AgentNeverHoldsVaultMoney fail for a reason that has nothing to do with
        // the contract. The handler already pranks as the agent, so exclude it as a raw sender.
        excludeSender(agent);
    }

    /// The contract must always hold at least what it owes the vault. Money cannot be conjured.
    function invariant_ContractIsSolvent() public view {
        assertGe(address(nanny).balance, nanny.getVault(vaultId).balance);
    }

    /// Every wei is accounted for: what came in equals what is still held plus what left.
    function invariant_NoWeiEscapesUnaccounted() public view {
        uint256 out = handler.totalSpent() + handler.totalRefunded();
        assertEq(handler.totalDeposited(), nanny.getVault(vaultId).balance + out);
    }

    /// The allowance can never outgrow its ceiling, no matter how the rules were shuffled.
    function invariant_AllowanceNeverExceedsCap() public view {
        assertLe(nanny.availableAllowance(vaultId), nanny.getVault(vaultId).accrualCap);
    }

    /// Spendable allowance can never exceed what is actually in the vault.
    function invariant_AllowanceNeverExceedsBalance() public view {
        assertLe(nanny.availableAllowance(vaultId), nanny.getVault(vaultId).balance);
    }

    /// A frozen vault is dead: no balance, no allowance, ever.
    function invariant_FrozenVaultIsEmpty() public view {
        if (nanny.getVault(vaultId).frozen) {
            assertEq(nanny.getVault(vaultId).balance, 0);
            assertEq(nanny.availableAllowance(vaultId), 0);
        }
    }

    /// The agent can never receive vault money directly — it only ever routes payments.
    function invariant_AgentNeverHoldsVaultMoney() public view {
        assertEq(agent.balance, 0);
    }
}

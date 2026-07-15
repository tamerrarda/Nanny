// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title NannyVault — a spending allowance vault for untrusted AI agents
/// @notice The money never sits in the agent's wallet. The agent may only request
///         spends, and every rule is enforced here, outside the agent's reach.
///         You can fool the agent. You can't fool the math.
contract NannyVault {
    struct Vault {
        address owner;
        address agent;
        uint256 balance;
        uint256 dripRate; // wei per second
        uint256 accrued; // allowance carried over, settled lazily
        uint256 lastUpdate;
        uint256 accrualCap; // allowance never grows past this
        uint256 perTxCap; // ceiling for a single spend
        bool frozen;
    }

    mapping(uint256 => Vault) private vaults;
    mapping(uint256 => mapping(address => bool)) public allowedRecipients;
    uint256 public nextVaultId;

    event VaultCreated(
        uint256 indexed vaultId, address indexed owner, address indexed agent, uint256 dripRate, uint256 deposited
    );
    event Deposited(uint256 indexed vaultId, uint256 amount, uint256 newBalance);
    event Spent(
        uint256 indexed vaultId, address indexed recipient, uint256 amount, string intent, uint256 timestamp
    );
    event Frozen(uint256 indexed vaultId, uint256 refunded);
    event RulesUpdated(uint256 indexed vaultId, uint256 dripRate, uint256 accrualCap, uint256 perTxCap);
    event RecipientAllowed(uint256 indexed vaultId, address indexed recipient, bool allowed);

    modifier onlyOwner(uint256 vaultId) {
        _onlyOwner(vaultId);
        _;
    }

    function _onlyOwner(uint256 vaultId) private view {
        require(msg.sender == vaults[vaultId].owner, "NANNY: not the owner");
    }

    /// @dev Reverts on any rule combination that would make a cap meaningless.
    function _validateRules(address agent, uint256 dripRate, uint256 accrualCap, uint256 perTxCap) private view {
        require(agent != address(0) && agent != msg.sender, "NANNY: invalid agent");
        require(dripRate > 0, "NANNY: drip rate required");
        require(accrualCap > 0 && perTxCap > 0, "NANNY: caps required");
        require(perTxCap <= accrualCap, "NANNY: per-tx cap above accrual cap");
    }

    /// @dev Folds elapsed time into `accrued` at the CURRENT drip rate, then stamps the clock.
    ///      Must run before any change to dripRate/accrualCap, otherwise elapsed time would be
    ///      retroactively re-priced at the new rate.
    function _settle(uint256 vaultId) private {
        Vault storage v = vaults[vaultId];
        uint256 grown = v.accrued + (block.timestamp - v.lastUpdate) * v.dripRate;
        v.accrued = grown > v.accrualCap ? v.accrualCap : grown;
        v.lastUpdate = block.timestamp;
    }

    function createVault(
        address agent,
        uint256 dripRate,
        uint256 accrualCap,
        uint256 perTxCap,
        address[] calldata recipients
    ) external payable returns (uint256 vaultId) {
        _validateRules(agent, dripRate, accrualCap, perTxCap);

        vaultId = nextVaultId++;
        vaults[vaultId] = Vault({
            owner: msg.sender,
            agent: agent,
            balance: msg.value,
            dripRate: dripRate,
            accrued: 0,
            lastUpdate: block.timestamp,
            accrualCap: accrualCap,
            perTxCap: perTxCap,
            frozen: false
        });

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "NANNY: invalid recipient");
            allowedRecipients[vaultId][recipients[i]] = true;
            emit RecipientAllowed(vaultId, recipients[i], true);
        }

        emit VaultCreated(vaultId, msg.sender, agent, dripRate, msg.value);
    }

    function deposit(uint256 vaultId) external payable onlyOwner(vaultId) {
        Vault storage v = vaults[vaultId];
        require(!v.frozen, "NANNY: vault frozen");
        v.balance += msg.value;
        emit Deposited(vaultId, msg.value, v.balance);
    }

    /// @notice The only way money leaves the vault towards a merchant. Agent-only, rule-bound.
    /// @param intent Why the agent is spending. Recorded on-chain as the accountability receipt.
    function spend(uint256 vaultId, address recipient, uint256 amount, string calldata intent) external {
        Vault storage v = vaults[vaultId];

        require(msg.sender == v.agent, "NANNY: not the agent");
        require(!v.frozen, "NANNY: vault frozen");
        require(bytes(intent).length > 0, "NANNY: intent required");
        require(allowedRecipients[vaultId][recipient], "NANNY: recipient not allowed");
        require(amount <= v.perTxCap, "NANNY: exceeds per-tx cap");

        _settle(vaultId);
        require(amount <= v.accrued, "NANNY: exceeds allowance");
        require(amount <= v.balance, "NANNY: insufficient balance");

        v.accrued -= amount;
        v.balance -= amount;

        emit Spent(vaultId, recipient, amount, intent, block.timestamp);

        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "NANNY: transfer failed");
    }

    /// @notice Kill switch. Returns every remaining wei to the owner. One-way by design.
    function freeze(uint256 vaultId) external onlyOwner(vaultId) {
        Vault storage v = vaults[vaultId];
        require(!v.frozen, "NANNY: vault frozen");

        uint256 refund = v.balance;
        v.frozen = true;
        v.balance = 0;
        v.accrued = 0;

        emit Frozen(vaultId, refund);

        if (refund > 0) {
            (bool ok,) = v.owner.call{value: refund}("");
            require(ok, "NANNY: refund failed");
        }
    }

    function updateRules(uint256 vaultId, uint256 dripRate, uint256 accrualCap, uint256 perTxCap)
        external
        onlyOwner(vaultId)
    {
        Vault storage v = vaults[vaultId];
        require(!v.frozen, "NANNY: vault frozen");
        _validateRules(v.agent, dripRate, accrualCap, perTxCap);

        _settle(vaultId); // price elapsed time at the OLD rate before switching

        v.dripRate = dripRate;
        v.accrualCap = accrualCap;
        v.perTxCap = perTxCap;
        if (v.accrued > accrualCap) v.accrued = accrualCap; // a lowered cap clips what already accrued

        emit RulesUpdated(vaultId, dripRate, accrualCap, perTxCap);
    }

    function addRecipient(uint256 vaultId, address recipient) external onlyOwner(vaultId) {
        require(recipient != address(0), "NANNY: invalid recipient");
        allowedRecipients[vaultId][recipient] = true;
        emit RecipientAllowed(vaultId, recipient, true);
    }

    function removeRecipient(uint256 vaultId, address recipient) external onlyOwner(vaultId) {
        allowedRecipients[vaultId][recipient] = false;
        emit RecipientAllowed(vaultId, recipient, false);
    }

    /// @notice Spendable allowance right now, without mutating state.
    function availableAllowance(uint256 vaultId) public view returns (uint256) {
        Vault storage v = vaults[vaultId];
        if (v.frozen) return 0;

        uint256 grown = v.accrued + (block.timestamp - v.lastUpdate) * v.dripRate;
        if (grown > v.accrualCap) grown = v.accrualCap;
        return grown > v.balance ? v.balance : grown;
    }

    function getVault(uint256 vaultId) external view returns (Vault memory) {
        return vaults[vaultId];
    }
}

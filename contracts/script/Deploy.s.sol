// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {NannyVault} from "../src/NannyVault.sol";

/// @notice Deploys NannyVault to Monad testnet.
/// @dev Run with a keystore (never a raw private key on the command line):
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url https://testnet-rpc.monad.xyz \
///     --account nanny-deployer \
///     --broadcast
contract Deploy is Script {
    function run() external returns (NannyVault nanny) {
        vm.startBroadcast();
        nanny = new NannyVault();
        vm.stopBroadcast();

        console.log("NannyVault deployed at:", address(nanny));
    }
}

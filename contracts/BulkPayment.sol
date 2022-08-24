// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;
/**
 * @dev We use ABIEncoderV2 to enable encoding/decoding of the array of structs. The pragma
 * is required, but ABIEncoderV2 is no longer considered experimental as of Solidity 0.6.0
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract BulkPayment is Ownable, Pausable, ReentrancyGuard {
    using Address for address payable;
    /**
     * @notice Placeholder token address for ETH donations. This address is used in various other
     * projects as a stand-in for ETH
     */
    address private constant ETH_TOKEN_PLACHOLDER =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    uint private protocolFee = 875; // rate = protocolFee / 100000

    uint private noFeeCharged = 1; // 0 = false : 1 = true

    /**
     * @notice Required parameters for each donation
     */
    struct Payment {
        address token; // address of the token to donate
        uint256 amount; // amount of tokens to donate
        address payable dest; // payee address
        bytes32 deliverable;
    }

    /**
     * @dev Emitted on each donation
     */
    event PaymentSent(
        address token,
        uint256 amount,
        address indexed dest,
        bytes32 indexed deliverable,
        address indexed payer
    );

    /**
     * @dev Emitted when a token or ETH is withdrawn from the contract
     */
    event TokenWithdrawn(
        address indexed token,
        uint256 indexed amount,
        address indexed dest
    );

    /**
     * @param _payments Array of payment structs
     */
    function pay(Payment[] calldata _payments)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        // We track total payments to ensure msg.value is exactly correct
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _payments.length; i++) {
            uint price = _payments[i].amount;
            console.log("price", price);

            emit PaymentSent(
                _payments[i].token,
                _payments[i].amount,
                _payments[i].dest,
                _payments[i].deliverable,
                msg.sender
            );

            if (_payments[i].token != ETH_TOKEN_PLACHOLDER) {
                // Token payment
                // This method throws on failure, so there is no return value to check
                SafeERC20.safeTransferFrom(
                    IERC20(_payments[i].token),
                    msg.sender,
                    _payments[i].dest,
                    _payments[i].amount
                );
            } else {
                // ETH payment
                _payments[i].dest.sendValue(_payments[i].amount);
                totalAmount = totalAmount + _payments[i].amount;
            }
        }

        console.log("totalAmount", totalAmount);

        // Revert if the wrong amount of ETH was sent
        require(
            msg.value == totalAmount,
            "bulkPayment: Too much ETH sent"
        );
    }

    /**
     * @param _payments Array of payment structs
     */
    // function payWithFee(Payment[] calldata _payments)
    //     external
    //     payable
    //     nonReentrant
    //     whenNotPaused
    // {
    //     // We track total payments to ensure msg.value is exactly correct
    //     uint256 totalAmount = 0;

    //     //protocol fee
    //     uint feeRate = protocolFee + 100000;
    //     uint total = (msg.value * 100000) / feeRate;

    //     for (uint256 i = 0; i < _payments.length; i++) {
    //         uint fee = (_payments[i].amount * 100000) / 10000;
    //         uint price = _payments[i].amount - fee;
    //         console.log("payWithFee:price", price);

    //         emit PaymentSent(
    //             _payments[i].token,
    //             price,
    //             _payments[i].dest,
    //             _payments[i].deliverable,
    //             msg.sender
    //         );

    //         if (_payments[i].token != ETH_TOKEN_PLACHOLDER) {
    //             // Token payment
    //             // This method throws on failure, so there is no return value to check
                
    //             SafeERC20.safeTransferFrom(
    //                 IERC20(_payments[i].token),
    //                 msg.sender,
    //                 _payments[i].dest,
    //                 price
    //             );
    //             SafeERC20.safeTransferFrom(
    //                 IERC20(_payments[i].token),
    //                 msg.sender,
    //                 address(this),
    //                 fee
    //             );
    //         } else {
    //             // ETH payment
    //             _payments[i].dest.sendValue(price);
    //             totalAmount = totalAmount + price;
    //         }
    //     }

    //     console.log("totalAmount", totalAmount);

    //     // Revert if the wrong amount of ETH was sent
    //     require(
    //         total == totalAmount,
    //         "bulkPayment: Too much ETH sent"
    //     );
    // }

    /**
     * @notice Transfers all tokens of the input adress to the recipient. This is
     * useful tokens are accidentally sent to this contrasct
     * @param _tokenAddress address of token to send
     * @param _dest destination address to send tokens to
     */
    function withdrawToken(address _tokenAddress, address _dest)
        external
        onlyOwner
    {
        uint256 _balance = IERC20(_tokenAddress).balanceOf(address(this));
        emit TokenWithdrawn(_tokenAddress, _balance, _dest);
        SafeERC20.safeTransfer(IERC20(_tokenAddress), _dest, _balance);
    }

    /**
     * @notice Transfers all Ether to the specified address
     * @param _dest destination address to send ETH to
     */
    function withdrawEther(address payable _dest) external onlyOwner {
        uint256 _balance = address(this).balance;
        emit TokenWithdrawn(ETH_TOKEN_PLACHOLDER, _balance, _dest);
        _dest.sendValue(_balance);
    }

    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner whenPaused {
        _unpause();
    }
}

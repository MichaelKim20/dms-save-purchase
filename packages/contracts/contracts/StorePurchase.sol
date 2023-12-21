// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./StorePurchaseStorage.sol";

/// @title A roll-up contract that stores block headers generated by roll-up rules in the blockchain
/// @author BOSagora Foundation
/// @notice Stored block headers sequentially
contract StorePurchase is StorePurchaseStorage, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    event AddedBlock(
        uint64 height,
        bytes32 curBlock,
        bytes32 prevBlock,
        bytes32 merkleRoot,
        uint64 timestamp,
        string cid
    );

    /// @notice 생성자
    function initialize() external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init_unchained();

        addGenesis();
    }

    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(_msgSender() == owner(), "Unauthorized access");
    }

    /// @notice Add newly created block header
    /// @param _height Height of new block
    /// @param _curBlock Hash of this block
    /// @param _prevBlock Hash of previous block
    /// @param _merkleRoot MerkleRoot hash of this block
    /// @param _timestamp Timestamp for this block
    /// @param _cid CID of IPFS
    function add(
        uint64 _height,
        bytes32 _curBlock,
        bytes32 _prevBlock,
        bytes32 _merkleRoot,
        uint64 _timestamp,
        string memory _cid
    ) external onlyOwner {
        require(lastHeight + 1 == _height, "3001");

        if (_height != 0 && _prevBlock != (blockArray[_height - 1]).curBlock) revert("3002");

        BlockHeader memory blockHeader = BlockHeader({
            height: _height,
            curBlock: _curBlock,
            prevBlock: _prevBlock,
            merkleRoot: _merkleRoot,
            timestamp: _timestamp,
            CID: _cid
        });
        blockArray.push(blockHeader);

        BlockHeight memory blockHeight = BlockHeight({ height: _height, exists: true });
        blockMap[_curBlock] = blockHeight;
        lastHeight = _height;
        emit AddedBlock(_height, _curBlock, _prevBlock, _merkleRoot, _timestamp, _cid);
    }

    function addGenesis() internal {
        BlockHeader memory blockHeader = BlockHeader({
            height: 0,
            curBlock: bytes32(0x0),
            prevBlock: bytes32(0x0),
            merkleRoot: bytes32(0x0),
            timestamp: 0,
            CID: "GENESIS"
        });
        blockArray.push(blockHeader);

        BlockHeight memory blockHeight = BlockHeight({ height: blockHeader.height, exists: true });
        blockMap[blockHeader.curBlock] = blockHeight;
        lastHeight = 0;

        emit AddedBlock(
            blockHeader.height,
            blockHeader.curBlock,
            blockHeader.prevBlock,
            blockHeader.merkleRoot,
            blockHeader.timestamp,
            blockHeader.CID
        );
    }

    /// @notice Get a blockheader by block height
    /// @param _height Height of the block header
    /// @return Block header of the height
    function getByHeight(
        uint64 _height
    ) external view returns (uint64, bytes32, bytes32, bytes32, uint64, string memory) {
        require(_height <= lastHeight, "3003");
        BlockHeader memory blockHeader = blockArray[_height];
        return (
            blockHeader.height,
            blockHeader.curBlock,
            blockHeader.prevBlock,
            blockHeader.merkleRoot,
            blockHeader.timestamp,
            blockHeader.CID
        );
    }

    /// @notice Get a blockheader by block hash
    /// @param _blockHash Block hash of the block
    /// @return Block header of the block hash
    function getByHash(
        bytes32 _blockHash
    ) external view returns (uint64, bytes32, bytes32, bytes32, uint64, string memory) {
        require(_blockHash.length == 32, "3004");
        require((blockMap[_blockHash]).exists, "3005");

        uint64 height = blockMap[_blockHash].height;
        BlockHeader memory blockHeader = blockArray[height];

        return (
            blockHeader.height,
            blockHeader.curBlock,
            blockHeader.prevBlock,
            blockHeader.merkleRoot,
            blockHeader.timestamp,
            blockHeader.CID
        );
    }

    /// @notice Get Block Header List
    /// @param _height Block height to start getting
    /// @param _size The size of the blocks
    /// @return Block header list
    function getByFromHeight(uint64 _height, uint8 _size) external view returns (BlockHeader[] memory) {
        require(_size > 0 && _size <= 32, "3006");
        require((_height + (_size - 1)) <= lastHeight, "3003");

        BlockHeader[] memory blockHeaders = new BlockHeader[](_size);
        uint8 j = 0;
        for (uint64 i = _height; i < (_height + _size); i++) blockHeaders[j++] = blockArray[i];
        return blockHeaders;
    }

    /// @notice Get a last block height
    /// @return The most recent block height
    function getLastHeight() external view returns (uint64) {
        return uint64(lastHeight);
    }

    /// @notice Get the block array length
    /// @return The block array length
    function size() external view returns (uint64) {
        return uint64(blockArray.length);
    }
}

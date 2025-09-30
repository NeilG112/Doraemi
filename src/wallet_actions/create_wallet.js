const {
  generateMnemonic,
  mnemonicToEntropy,
} = require("ethereum-cryptography/bip39");
const { wordlist } = require("ethereum-cryptography/bip39/wordlists/english");
const { HDKey } = require("ethereum-cryptography/hdkey");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");
const { keccak256 } = require("ethereum-cryptography/keccak");
const { bytesToHex } = require("ethereum-cryptography/utils");
const { writeFileSync } = require("fs");

function _generateMnemonic() {
  const strength = 256; // 256 bits, 24 words; default is 128 bits, 12 words
  const mnemonic = generateMnemonic(wordlist, strength);
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  return { mnemonic, entropy };
}

// The HDKey is a Hierarchical Deterministic key from which we can derive child keys.
function _getHdRootKey(_entropy) {
  return HDKey.fromMasterSeed(_entropy);
}

// We derive a child key from the root key. This is our private key.
function _generatePrivateKey(_hdRootKey, _accountIndex) {
  // The path is m/44'/60'/0'/0/account_index
  return _hdRootKey.derive("m/44'/60'/0'/0/" + _accountIndex).privateKey;
}

// The public key is derived from the private key.
// We set isCompressed to false to get the uncompressed public key (65 bytes).
function _getPublicKey(_privateKey) {
  return secp256k1.getPublicKey(_privateKey);
}

// The Ethereum address is the last 20 bytes of the Keccak-256 hash of the public key.
// We need to discard the first byte of the uncompressed public key (the 0x04 prefix) before hashing.
function _getEthAddress(_publicKey) {
  return keccak256(_publicKey.slice(1)).slice(-20);
}



function createWallet(){

  //The mnemonic is a random sentence of words from a predefined list.
  const { mnemonic, entropy } = _generateMnemonic();
  // In production, avoid logging sensitive data like mnemonics.
  // This might be useful for debugging in development, but should be removed for production.
  
  
  //The HDKey is a Hierarchical Deterministic key from which we can derive child keys.
  const hdRootKey = _getHdRootKey(entropy);

  const accountOneIndex = 0;
  
  
  //We derive a child key from the root key. This is our private key.
  //The path is m/44'/60'/0'/0/account_index
  const walletPrivateKey = _generatePrivateKey(hdRootKey, accountOneIndex);
  
  
  //The public key is derived from the private key.
  const walletPublicKey = _getPublicKey(walletPrivateKey);
  
  //We set isCompressed to false to get the uncompressed public key (65 bytes).
  const walletAddress = _getEthAddress(walletPublicKey);


  return {
    mnemonic: mnemonic,
    walletPrivateKey: "0x" + bytesToHex(walletPrivateKey),
    walletPublicKey: "0x" + bytesToHex(walletPublicKey),
    walletAddress: "0x" + bytesToHex(walletAddress)
  }

}


module.exports = { createWallet };
const { InfuraProvider, Wallet, parseEther, formatEther, isAddress } = require("ethers");

/**
 * Sends a specified amount of ETH from a sender's wallet to a receiver's address.
 * @param {string} senderPrivateKey The private key of the sender's wallet.
 * @param {string} receiverAddress The receiver's Ethereum address.
 * @param {string} ethAmount The amount of ETH to send, as a string.
 * @returns {Promise<import("ethers").TransactionResponse>} The transaction response object.
 */
async function sendTransaction(senderPrivateKey, receiverAddress, ethAmount) {
  // Input validation
  if (!receiverAddress || !isAddress(receiverAddress)) {
    throw new Error(`Invalid receiver address provided: ${receiverAddress}`);
  }
  if (!ethAmount || isNaN(parseFloat(ethAmount)) || parseFloat(ethAmount) <= 0) {
    throw new Error(`Invalid ETH amount: '${ethAmount}'. It must be a positive number.`);
  }

  const network = "sepolia";
  const apiKey = process.env.INFURA_API_KEY;
  if (!apiKey) {
    throw new Error("INFURA_API_KEY is not set in the environment variables.");
  }
  const provider = new InfuraProvider(network, apiKey);

  // Ensure private key has '0x' prefix for robustness.
  if (!senderPrivateKey.startsWith('0x')) {
    senderPrivateKey = '0x' + senderPrivateKey;
  }

  const signer = new Wallet(senderPrivateKey, provider);
  console.log(`Sender address: ${signer.address}`);

  // Check sender's balance before attempting to send.
  const balance = await provider.getBalance(signer.address);
  const balanceInEth = formatEther(balance);
  console.log(`Sender balance: ${balanceInEth} ETH`);

  const amountToSend = parseEther(String(ethAmount));

  const tx = {
    to: receiverAddress,
    value: amountToSend,
  };

  // Estimate gas cost to check for sufficient funds
  const gasLimit = await signer.estimateGas(tx);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
  if (!gasPrice) {
    throw new Error("Could not retrieve gas price from the provider.");
  }
  const estimatedGasCost = gasLimit * gasPrice;

  if (balance < (amountToSend + estimatedGasCost)) {
      throw new Error(`Insufficient funds. Balance: ${balanceInEth} ETH, trying to send: ${ethAmount} ETH (plus ~${formatEther(estimatedGasCost)} ETH for gas)`);
  }

  console.log(`Sending ${ethAmount} ETH to ${receiverAddress}...`);

  return signer.sendTransaction(tx);
}

module.exports = { sendTransaction };
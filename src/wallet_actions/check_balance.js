const { InfuraProvider, formatEther } = require("ethers");

async function checkBalance(_walletAddress) {
  const network = "sepolia";
  // Use the Infura API key from the environment variables
  const apiKey = process.env.INFURA_API_KEY;
  const provider = new InfuraProvider(network, apiKey);
  const balance = await provider.getBalance(_walletAddress);


  return formatEther(balance);
  // For direct script execution
}

module.exports = { checkBalance };
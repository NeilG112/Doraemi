const ethers = require('ethers');
const fs = require('fs');

async function restoreWallet() {
    const mnemonic = 'YOUR_MNEMONIC_HERE'; // Replace with your mnemonic
        const wallet = ethers.Wallet.fromMnemonic(mnemonic);
            console.log('Address:', wallet.address);
                console.log('Private Key:', wallet.privateKey);

                    const account = {
                            address: wallet.address,
                                    privateKey: wallet.privateKey,
                                            mnemonic: wallet.mnemonic.phrase
                                                };

                                                    fs.writeFileSync('account2.json', JSON.stringify(account, null, 2));
                                                        console.log('Restored account details saved to account2.json');
                                                        }

                                                        restoreWallet();
                                                        
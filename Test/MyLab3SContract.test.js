const assert  = require('assert');
const ganache = require('ganache-cli');
const Web3    = require('web3');            // ← plus de .default
const web3    = new Web3(ganache.provider());

let accounts;
beforeEach(async () => {
  accounts = await web3.eth.getAccounts();
});

describe('MyLab3SContract', () => {
  it('Déployer un contrat', () => {
    console.log(accounts);
  });
});
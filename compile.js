const path = require('path');
const fs   = require('fs');
const solc = require('solc');

// 1. Lecture du contrat
const contractPath = path.resolve(__dirname, 'Bonjour.sol');
const source       = fs.readFileSync(contractPath, 'utf8');

// 2. Préparation de l'entrée standard-json
const input = {
  language: 'Solidity',
  sources: {
    'Bonjour.sol': { content: source }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    }
  }
};

// 3. Compilation
const output = JSON.parse(solc.compile(JSON.stringify(input))).contracts['Bonjour.sol'];

// 4. Écriture des artefacts dans ./build
const buildDir = path.resolve(__dirname, 'build');
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

for (const name in output) {
  const { abi, evm } = output[name];
  fs.writeFileSync(path.join(buildDir, name + '.abi'), JSON.stringify(abi, null, 2));
  fs.writeFileSync(path.join(buildDir, name + '.bin'), evm.bytecode.object);
  console.log(`✅ Contract ${name} compilé.`);
}
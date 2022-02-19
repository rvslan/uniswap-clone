require('@nomiclabs/hardhat-waffle');

module.exports = {
  solidity: '0.8.0',
  networks: {
    rinkeby: {
      url: 'https://eth-rinkeby.alchemyapi.io/v2/wIpzjKIN-lEDhPLLMZuJMwP8OHzR5__Q',
      accounts: [
        'ea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0',
      ],
    },
  },
};

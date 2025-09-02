const DonationEscrow = artifacts.require("DonationEscrow");

module.exports = async function (deployer) {
  await deployer.deploy(DonationEscrow);
};

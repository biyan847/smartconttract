const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DonationEscrow", function () {
  let DonationEscrow, donationEscrow;
  let admin, user1, user2;

  // Deploy kontrak dan ambil 3 akun sebelum setiap test
  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();
    DonationEscrow = await ethers.getContractFactory("DonationEscrow");
    donationEscrow = await DonationEscrow.deploy();
    await donationEscrow.waitForDeployment(); // ethers v6
  });

  // Test: Siapa saja bisa membuat campaign
  it("should allow anyone to create a campaign", async function () {
    await donationEscrow
      .connect(user1)
      .createCampaign("A", ethers.parseEther("1"));
    await donationEscrow
      .connect(user2)
      .createCampaign("B", ethers.parseEther("2"));

    const campaign1 = await donationEscrow.getCampaign(0);
    const campaign2 = await donationEscrow.getCampaign(1);

    expect(campaign1.title).to.equal("A");
    expect(campaign1.creator).to.equal(user1.address);
    expect(campaign2.title).to.equal("B");
    expect(campaign2.creator).to.equal(user2.address);
  });

  // Test: Siapa saja bisa donasi dan histori donasi tercatat dengan benar
  it("should allow anyone to donate and track donations", async function () {
    await donationEscrow
      .connect(user1)
      .createCampaign("A", ethers.parseEther("1"));
    await donationEscrow
      .connect(user2)
      .donateToCampaign(0, { value: ethers.parseEther("0.5") });
    await donationEscrow
      .connect(user1)
      .donateToCampaign(0, { value: ethers.parseEther("0.7") });

    const [donors, amounts] = await donationEscrow.getDonationHistory(0);
    expect(donors).to.include(user2.address);
    expect(donors).to.include(user1.address);
    expect(amounts.map((a) => a.toString())).to.include(
      ethers.parseEther("0.5").toString()
    );
    expect(amounts.map((a) => a.toString())).to.include(
      ethers.parseEther("0.7").toString()
    );
  });

  // Test: Hanya admin yang bisa withdraw, dan hanya setelah goal tercapai
  it("should allow only admin to withdraw after goal reached", async function () {
    await donationEscrow
      .connect(user1)
      .createCampaign("A", ethers.parseEther("1"));
    await donationEscrow
      .connect(user2)
      .donateToCampaign(0, { value: ethers.parseEther("1") });

    // Non-admin tidak boleh withdraw
    await expect(
      donationEscrow.connect(user1).withdrawFunds(0)
    ).to.be.revertedWith("Only admin can perform this action");

    // Goal belum tercapai di campaign 1
    await donationEscrow
      .connect(user2)
      .createCampaign("B", ethers.parseEther("2"));
    await donationEscrow
      .connect(user1)
      .donateToCampaign(1, { value: ethers.parseEther("1") });
    await expect(
      donationEscrow.connect(admin).withdrawFunds(1)
    ).to.be.revertedWith("Goal not yet reached");

    // Admin withdraw campaign 0 setelah goal tercapai
    const adminBalBefore = await ethers.provider.getBalance(admin.address);
    await donationEscrow.connect(admin).withdrawFunds(0);
    const adminBalAfter = await ethers.provider.getBalance(admin.address);

    expect(adminBalAfter).to.be.greaterThan(
      adminBalBefore + ethers.parseEther("0.99")
    );
  });

  // Test: Tidak bisa withdraw 2x pada campaign yang sama
  it("should prevent double withdraw", async function () {
    await donationEscrow
      .connect(user1)
      .createCampaign("A", ethers.parseEther("1"));
    await donationEscrow
      .connect(user2)
      .donateToCampaign(0, { value: ethers.parseEther("1") });

    await donationEscrow.connect(admin).withdrawFunds(0);

    // Coba withdraw lagi harus revert
    await expect(
      donationEscrow.connect(admin).withdrawFunds(0)
    ).to.be.revertedWith("Already withdrawn");
  });

  // Test: Donasi 0 ether harus gagal
  it("should revert if donation value is zero", async function () {
    await donationEscrow
      .connect(user1)
      .createCampaign("A", ethers.parseEther("1"));
    await expect(
      donationEscrow.connect(user2).donateToCampaign(0, { value: 0 })
    ).to.be.revertedWith("Donation must be more than 0");
  });

  // Test: Tidak bisa donasi ke campaign yang tidak ada
  it("should revert if donating to non-existent campaign", async function () {
    await expect(
      donationEscrow
        .connect(user2)
        .donateToCampaign(99, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Invalid campaign ID");
  });

  // Test: Tidak bisa withdraw campaign yang tidak ada
  it("should revert if withdrawing non-existent campaign", async function () {
    await expect(
      donationEscrow.connect(admin).withdrawFunds(88)
    ).to.be.revertedWith("Invalid campaign ID");
  });

  // Test: Tidak bisa donasi ke campaign yang sudah withdrawn/completed
  it("should revert if donating to a completed campaign", async function () {
    await donationEscrow
      .connect(user1)
      .createCampaign("A", ethers.parseEther("1"));
    await donationEscrow
      .connect(user2)
      .donateToCampaign(0, { value: ethers.parseEther("1") });
    await donationEscrow.connect(admin).withdrawFunds(0); // campaign jadi completed

    await expect(
      donationEscrow
        .connect(user2)
        .donateToCampaign(0, { value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("Campaign already completed");
  });

  // Test: Event emission (CampaignCreated, DonationReceived, FundsWithdrawn)
  it("should emit events for campaign creation, donation, and withdraw", async function () {
    // CampaignCreated
    await expect(
      donationEscrow
        .connect(user1)
        .createCampaign("TestEvent", ethers.parseEther("2"))
    )
      .to.emit(donationEscrow, "CampaignCreated")
      .withArgs(0, "TestEvent", ethers.parseEther("2"));

    // DonationReceived
    await expect(
      donationEscrow
        .connect(user2)
        .donateToCampaign(0, { value: ethers.parseEther("1") })
    )
      .to.emit(donationEscrow, "DonationReceived")
      .withArgs(
        0,
        user2.address,
        ethers.parseEther("1"),
        ethers.parseEther("1")
      );

    // Tambahkan donasi lagi agar balance menjadi 2 ether
    await donationEscrow
      .connect(user2)
      .donateToCampaign(0, { value: ethers.parseEther("1") });

    // FundsWithdrawn
    await expect(donationEscrow.connect(admin).withdrawFunds(0))
      .to.emit(donationEscrow, "FundsWithdrawn")
      .withArgs(0, ethers.parseEther("2"));
  });
});

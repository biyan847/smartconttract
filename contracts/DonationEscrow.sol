// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DonationEscrow
 * @dev A smart contract to manage donation campaigns. An admin creates campaigns,
 * users can donate, and the admin can withdraw funds once the goal is met.
 */
contract DonationEscrow {
    address public admin;
    uint public campaignCount = 0;

    struct Campaign {
        address creator;        
        string title;           
        uint goal;              
        uint balance;           
        bool completed;         
        mapping(address => uint) donors; 
        address[] donorAddresses;     
    }

    mapping(uint => Campaign) public campaigns;

    // --- Events ---
    event CampaignCreated(uint indexed campaignId, string title, uint goal);
    event DonationReceived(uint indexed campaignId, address indexed donor, uint amount, uint newBalance);
    event FundsWithdrawn(uint indexed campaignId, uint amount);

    /**
     * @dev Sets the contract deployer as the admin.
     */
    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Modifier to restrict function access to the admin only.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    /**
     * @dev Allows the admin to create a new donation campaign.
     * @param _title The title for the new campaign.
     * @param _goal The funding goal in wei for the new campaign.
     */
    function createCampaign(string memory _title, uint _goal) public {
        require(_goal > 0, "Goal must be more than 0");

        
        Campaign storage newCampaign = campaigns[campaignCount];
        newCampaign.creator = msg.sender;
        newCampaign.title = _title;
        newCampaign.goal = _goal;
        
        newCampaign.balance = 0;
        newCampaign.completed = false;

        emit CampaignCreated(campaignCount, _title, _goal);
        campaignCount++;
    }

    /**
     * @dev Allows any user to donate to a specific campaign.
     * @param _id The ID of the campaign to donate to.
     */
    function donateToCampaign(uint _id) public payable {
        require(_id < campaignCount, "Invalid campaign ID");
        Campaign storage campaign = campaigns[_id];
        require(!campaign.completed, "Campaign already completed");
        require(msg.value > 0, "Donation must be more than 0");

        
        campaign.balance += msg.value;

        
        if (campaign.donors[msg.sender] == 0) {
            campaign.donorAddresses.push(msg.sender);
        }

        
        campaign.donors[msg.sender] += msg.value;

        emit DonationReceived(_id, msg.sender, msg.value, campaign.balance);
    }

    /**
     * @dev Allows the admin to withdraw the collected funds after the goal is reached.
     * @param _id The ID of the campaign to withdraw from.
     */
    function withdrawFunds(uint _id) public onlyAdmin {
        require(_id < campaignCount, "Invalid campaign ID");
        Campaign storage campaign = campaigns[_id];
        require(!campaign.completed, "Already withdrawn");
        require(campaign.balance >= campaign.goal, "Goal not yet reached");

        uint amount = campaign.balance;
        campaign.completed = true;
        campaign.balance = 0;

        // Transfer funds to the admin
        payable(admin).transfer(amount);
        emit FundsWithdrawn(_id, amount);
    }

    // --- View Functions ---

    /**
     * @dev Retrieves core details of a specific campaign.
     * @param _id The ID of the campaign.
     * @return creator The address of the campaign creator.
     * @return title The title of the campaign.
     * @return goal The funding goal of the campaign.
     * @return balance The current balance of the campaign.
     * @return completed Whether the campaign funds have been withdrawn.
     */
    function getCampaign(uint _id) public view returns (
        address creator,
        string memory title,
        uint goal,
        uint balance,
        bool completed
    ) {
        require(_id < campaignCount, "Invalid campaign ID");
        // Use a storage pointer to reference the campaign data directly.
        // This avoids the error of trying to copy a struct with a mapping to memory.
        Campaign storage c = campaigns[_id];
        return (c.creator, c.title, c.goal, c.balance, c.completed);
    }

    /**
     * @dev Retrieves the full donation history for a campaign.
     * @param _id The ID of the campaign.
     * @return A list of all donor addresses.
     * @return A list of corresponding donation amounts.
     */
    function getDonationHistory(uint _id) public view returns (address[] memory, uint[] memory) {
        require(_id < campaignCount, "Invalid campaign ID");
        Campaign storage campaign = campaigns[_id];

        uint donorCount = campaign.donorAddresses.length;
        address[] memory donorsList = new address[](donorCount);
        uint[] memory amounts = new uint[](donorCount);

        for (uint i = 0; i < donorCount; i++) {
            address donor = campaign.donorAddresses[i];
            donorsList[i] = donor;
            amounts[i] = campaign.donors[donor];
        }

        return (donorsList, amounts);
    }
}
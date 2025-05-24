import { v4 as uuidv4 } from 'uuid';

export const initializeLocalStorage = () => {
  // Check if localStorage is already initialized
  if (!localStorage.getItem('initialized')) {
    generateDummyData();
    localStorage.setItem('initialized', 'true');
    console.log('localStorage initialized with dummy data');
  } else {
    console.log('localStorage already initialized');
  }
};

export const generateDummyData = () => {
  const users = [
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      profilePicture: "https://api.dicebear.com/7.x/lorelei/svg?seed=John",
      role: "admin",
      verified: true,
      walletBalance: 5000,
      accountNumber: "2012345678",
      accountName: "John Doe",
      notifications: []
    },
    {
      id: "2", 
      name: "Jane Smith",
      email: "jane@example.com",
      password: "password123",
      profilePicture: "https://api.dicebear.com/7.x/lorelei/svg?seed=Jane",
      role: "user",
      verified: true,
      walletBalance: 3000,
      accountNumber: "2023456789",
      accountName: "Jane Smith",
      notifications: []
    },
    {
      id: "3",
      name: "Mike Johnson", 
      email: "mike@example.com",
      password: "password123",
      profilePicture: "https://api.dicebear.com/7.x/lorelei/svg?seed=Mike",
      role: "user",
      verified: true,
      walletBalance: 2500,
      accountNumber: "2034567890",
      accountName: "Mike Johnson",
      notifications: []
    }
  ];

  const contributions = [
    {
      id: "1",
      name: "Emergency Fund",
      description: "Building an emergency fund for the team",
      targetAmount: 50000,
      currentAmount: 25000,
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      frequency: "monthly",
      isPrivate: false,
      allowAnonymous: true,
      requireApproval: false,
      adminId: "1",
      creatorId: "1",
      category: "Emergency",
      visibility: "public",
      status: "active",
      deadline: "2024-12-31",
      votingThreshold: 60,
      privacy: "public",
      memberRoles: "equal",
      accountNumber: "6012345678",
      members: ["1", "2", "3"],
      contributors: [
        { userId: "1", name: "John Doe", amount: 15000, date: "2024-01-15", anonymous: false },
        { userId: "2", name: "Jane Smith", amount: 10000, date: "2024-01-20", anonymous: true }
      ],
      withdrawalRequests: []
    },
    {
      id: "2",
      name: "Vacation Fund",
      description: "Saving for a group vacation",
      targetAmount: 100000,
      currentAmount: 45000,
      startDate: "2024-02-01", 
      endDate: "2024-11-30",
      frequency: "weekly",
      isPrivate: false,
      allowAnonymous: false,
      requireApproval: true,
      adminId: "2",
      creatorId: "2",
      category: "Travel",
      visibility: "public",
      status: "active",
      deadline: "2024-11-30",
      votingThreshold: 75,
      privacy: "public",
      memberRoles: "equal",
      accountNumber: "6023456789",
      members: ["1", "2", "3"],
      contributors: [
        { userId: "2", name: "Jane Smith", amount: 25000, date: "2024-02-05", anonymous: false }
      ],
      withdrawalRequests: [
        {
          id: "1",
          contributionId: "2",
          userId: "2",
          amount: 20000,
          purpose: "Flight bookings",
          reason: "Need to book flights early for better rates",
          beneficiary: "Travel Agency XYZ",
          accountNumber: "1234567890",
          bankName: "First Bank",
          status: "pending",
          createdAt: "2024-01-25T10:00:00Z",
          deadline: "2024-02-01T10:00:00Z",
          votes: {
            "1": "approve",
            "3": "reject"
          }
        }
      ]
    }
  ];

  const transactions = [
    {
      id: "1",
      userId: "1",
      type: "contribution",
      amount: 15000,
      description: "Contribution to Emergency Fund",
      status: "completed",
      createdAt: "2024-01-15T08:00:00Z",
      contributionId: "1"
    },
    {
      id: "2", 
      userId: "2",
      type: "contribution",
      amount: 10000,
      description: "Anonymous contribution to Emergency Fund",
      status: "completed",
      createdAt: "2024-01-20T14:30:00Z",
      contributionId: "1",
      anonymous: true
    }
  ];

  // Store the data
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('contributions', JSON.stringify(contributions));
  localStorage.setItem('transactions', JSON.stringify(transactions));

  console.log('Dummy data generated successfully');
};

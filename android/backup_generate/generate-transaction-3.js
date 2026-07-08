const fs = require("fs");

const raw = `
30/11/18 : Salary : $41050

03/12/18 : Capital First Refund : $592.22

03/12/18 : Get it From Vivek for Bike Repair : $2000

03/12/18 : Refund Food Panda : $19

18/12/18 : Collection Money For Marriage Gift : $500

18/12/18 : Bike Insurance : $92298

26/12/18 : Get it From Abi : $200
`;

const categoryMap = {
  // Food
  "Breakfast": 17,
  "Lunch": 17,
  "Lunch : Briyani": 17,
  "Dinner": 17,
  "Dinner ": 17,
  "Dinner​": 17,
  "Dinner Purchase": 17,
  "Burger & Nuggets": 17,
  "Noodles": 17,

  // Fruits
  "Fruits": 18,
  "Apple & Orange": 18,
  "Grapes": 18,
  "Papaya": 18,
  "Pomegranate": 18,

  // Groceries
  "Grocery": 22,
  "Vegetables": 22,
  "Vegetables & Fruits": 22,
  "Vegetables & Chicken": 22,
  "Mutton & Vegetables": 22,
  "Milk": 22,
  "Milk & Dry chilli": 22,
  "Milk & Currie Leaves": 22,
  "10Eggs": 22,
  "Egg and washing soap": 22,
  "Carrot": 22,
  "Carrots": 22,
  "Carrots ": 22,
  "Carrots, Eggs & Banana": 22,
  "Cashew and Dry Grapes": 22,
  "Chicken, Masala & Coriander": 22,
  "Beans, Rice, Pickle & Biscuits": 22,
  "Black Gram": 22,
  "Black Gram 1/4kg": 22,
  "Bread, Jam, Water cane": 22,
  "Cinthol Soaps": 22,
  "Coconut": 22,
  "Cooking Oil": 22,
  "Dandruff Shampoo": 22,
  "Dates & Ice Cream": 22,
  "Dhall & Chilli": 22,
  "Dustbin Cover": 22,
  "Flour Mix": 22,
  "Flour, Oil & Soaps": 22,
  "Ice Cream & Washing Powder": 22,
  "Idly Rice": 22,
  "Plastic Bag": 22,
  "Salt & Coffee Powder": 22,
  "Shampoo": 22,
  "Spinach, Coconut & Tomatoes": 22,
  "Tender Coconut": 22,

  // Snacks
  "Snack": 43,
  "Snacks": 43,
  "Evening Snacks": 43,
  "Dinner Snacks": 43,
  "Dinner Snacks & Parking": 43,
  "Bakery Snacks": 43,
  "Chocolate": 43,
  "Cool Drinks": 43,
  "Juice": 43,
  "Lattu & Food": 43,
  "Rusk": 43,
  "Snacks For Abi": 43,
  "Snacks Spend": 43,
  "Sweets": 43,
  "Water Bottles": 43,

  // Vehicle
  "Petrol": 4,
  "Bike Petrol": 4,
  "Petrol & Air": 4,
  "Bike Air": 4,
  "Bike Parking": 4,
  "Helmet": 4,
  "Pulsar: Bike Repair": 4,
  "Royal Enfield: Service": 4,
  "Royal Enfield: Service & Insurance": 4,
  "Water Wash": 4,

  // Medical
  "Pregnancy Test": 6,
  "Cold Medicine": 25,
  "Eye Ointment": 25,
  "Hospital Bill": 25,
  "Medical Bill": 25,
  "Medicare Shampoo": 25,

  // Households
  "House Holds": 26,
  "Household Things": 26,
  "Households": 26,
  "Knife & Washing Brush": 26,
  "Tiffan Box": 26,

  // Utilities
  "Electricity Bill": 12,
  "Pdkt Home Electricity Bill": 12,

  // Electronics
  "Watch Pin": 13,
  "Purchased UPS": 13,
  "Bang Sony TV 32 Inch: Bajaj Card": 13,
  "Bang Sony TV 32 Inch: Initial Amount": 13,
  "Bang Sony TV 32 Inch: Proof Approval": 13,
  "Bang Sony TV 32 Inch: Stabilizer": 13,

  // Clothing
  "Dress": 7,
  "Jacket & Inner For Abi": 7,
  "Purchase Pant": 7,
  "Purchase Shirt": 7,
  "Sandals": 41,

  // Entertainment
  "Movie": 15,
  "Party": 15,
  "Park": 15,
  "Park & Parking": 15,
  "Exhibition": 15,
  "Bike Parking in Theatre": 15,

  // Gift
  "Gift": 21,
  "Birthday Gift": 21,
  "Birthday Cake": 21,
  "Birthday Presents": 21,
  "Henry Marriage Gift": 21,
  "Priya Adhiyamaan Marriage Gift": 21,
  "Send Off": 21,

  // Mobile
  "Mobile Back Cover": 31,
  "Back Cover": 31,
  "Recharge": 31,
  "Recharge Airtel": 31,
  "Recharge For Abi": 31,
  "Recharge For Mom": 31,
  "Recharge to Airtel": 31,
  "DTH Recharge": 31,
  "Mi Mobile Service Tax": 31,
  "Screen Card": 31,
  "Sim Card": 31,
  "Sim Card & Link Adhaar": 31,

  // Loan
  "Bike EMI": 29,
  "Personal Loan EMI": 29,
  "Capital First Loan Paid": 29,
  "Spend for Loan": 29,
  "Bang Sony TV 32 Inch: Auto Debit": 29,

  // Savings
  "RD": 42,
  "Rd": 42,
  "Recurring Deposit": 42,
  "Recurring Deposit ": 42,
  "Recurrent Deposit": 42,

  // Money Given
  "Give it Back": 33,
  "Give it back": 33,
  "Give it back Sasi": 33,
  "Give it Back Vivek": 33,
  "Give it Back Vetrivel": 33,
  "Give back": 33,
  "Give back ": 33,
  "Give back to Deepak": 33,
  "Give back to Dinesh": 33,
  "Give back to KD": 33,
  "Give back to Madhu": 33,
  "Give back to Naveen": 33,
  "Gave it Back": 33,
  "Gave it to Ravi": 33,
  "Gave to Ravi": 33,
  "Gave to Naveen": 33,
  "Gave to Mom": 33,
  "Gave to Ram": 33,
  "Gave to Sasi": 33,
  "Gave to Dinesh": 33,
  "Gave to Akka": 33,
  "Gave to Madhu": 33,
  "Gave to Aboo": 33,
  "Gave to": 33,

  // Money Received
  "Get it From Abi": 34,
  "Get it From Dad": 34,
  "Get it From Mom": 34,
  "Get it From Naveen": 34,
  "Get it From Ramya": 34,
  "Get it From Ravi": 34,
  "Get it From Vetrivel": 34,
  "Get it From Vivek": 34,
  "Get it From Dinesh": 34,
  "Get it From Mams": 34,
  "Get it From Bag": 34,
  "Get it From Thali Pirichu Potta Function": 34,
  "Get From Deepak": 34,
  "Get From Dinesh": 34,
  "Get From Sasi": 34,
  "Get From Shufil": 34,
  "Lunch Amount": 34,
  "Room Advance Returned ": 34,
  "Available Amount ": 34,

  // Rent
  "Room Rent": 38,
  "Room: Rent": 38,
  "Room Advance": 38,
  "Room Advance Returned": 38,
  "Room Rental Agreement": 38,
  "Room Shifting": 38,
  "Room: EB Deposit": 38,
  "Room: Electricity Bill": 38,
  "Room: Internet Bill": 38,
  "Room: Water": 38,
  "Room: Water Bill": 38,
  "Room: Water Cane": 38,
  "Room: Hit Purchase": 38,
  "Room: Spend": 38,
  "House Warming": 38,
  "Give Back to Dinesh & Room Rent": 38,

  // Salary
  "March Month 2017": 39,
  "April Month 2017": 39,
  "May Month 2017": 39,
  "June Month 2017": 39,
  "July Month 2017": 39,
  "August Month 2017": 39,
  "September Month 2017": 39,
  "October Month 2017": 39,

  // Personal Care
  "Hair Cut": 40,
  "Hair Cut For Abi": 40,
  "Hair Cut For Myself ": 40,
  "Hair Cut For Myself  ": 40,

  // Travel
  "Trip Amount": 47,
  "Thirupathi Trip": 47,
  "Bennargetta Zoo Spend": 47,
  "Lalbagh": 47,
  "Lalbagh Tickets": 47,
  "Bus : Lalbagh to Room": 47,
  "Bus : Room to Lalbagh": 47,
  "Shiradi: Expenses": 47,
  "Shiradi: Bus Booking & Others": 47,

  // Water
  "Water Cane": 49,

  // Default
  "Default": 30
};

let id = 93;

const transactions = raw
  .trim()
  .split("\n")
  .filter(line => line.trim() && !line.trim().startsWith("//"))
  .map(line => {
    const match = line.match(/^(\d{2}\/\d{2}\/\d{2})\s*:\s*(.*?)\s*:\s*\$(.+)$/);
    if (!match) {
      console.log("Invalid line:", line);
      return null;
    }
    const [, date, notes, amountStr] = match;
    const [dd, mm, yy] = date.split("/");
    const formattedDate = `20${yy}-${mm}-${dd}`;
    return {
      id: id++,
      type: "income", // expense OR income
      amount: Number(amountStr.trim()),
      category_id: categoryMap[notes] ?? categoryMap.Default,
      source_id: 3,
      date: formattedDate,
      notes,
      bill_id: null,
      created_at: `${formattedDate} 00:00:00`,
      transfer_group_id: null,
      direction: null
    };
  })
  .filter(Boolean);

const backup = {
  version: 1,
  timestamp: new Date().toISOString(),
  data: {
    transactions,
    "categories": [
      {
        "id": 1,
        "name": "Abinaya Birthday",
        "type": "expense",
        "icon": "cake",
        "color": "#A78BFA",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 2,
        "name": "Bank Charges",
        "type": "expense",
        "icon": "bank",
        "color": "#374151",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 3,
        "name": "Beauty Care",
        "type": "expense",
        "icon": "cards-heart-outline",
        "color": "#DB2777",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 4,
        "name": "Bike / Vehicle",
        "type": "expense",
        "icon": "motorbike",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 5,
        "name": "Cashback",
        "type": "income",
        "icon": "cash-plus",
        "color": "#A3E635",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 6,
        "name": "Child Birth",
        "type": "expense",
        "icon": "baby-carriage",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 7,
        "name": "Clothes",
        "type": "expense",
        "icon": "tshirt-v",
        "color": "#FB923C",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 8,
        "name": "DTH",
        "type": "expense",
        "icon": "television-play",
        "color": "#8B5CF6",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 9,
        "name": "Diwali",
        "type": "expense",
        "icon": "firework",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 10,
        "name": "Donations",
        "type": "expense",
        "icon": "hand-heart",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 11,
        "name": "Drinks",
        "type": "expense",
        "icon": "liquor",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 12,
        "name": "Electricity",
        "type": "expense",
        "icon": "power-plug",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 13,
        "name": "Electronics",
        "type": "expense",
        "icon": "devices",
        "color": "#A78BFA",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 14,
        "name": "Eniyan",
        "type": "expense",
        "icon": "human-female-dance",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 15,
        "name": "Entertainment",
        "type": "expense",
        "icon": "movie-open",
        "color": "#7C3AED",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 16,
        "name": "Family",
        "type": "expense",
        "icon": "account-group",
        "color": "#F43F5E",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 17,
        "name": "Food & Dining",
        "type": "expense",
        "icon": "silverware-fork-knife",
        "color": "#F59E0B",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 18,
        "name": "Fruits",
        "type": "expense",
        "icon": "fruit-watermelon",
        "color": "#84CC16",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 19,
        "name": "Gas",
        "type": "expense",
        "icon": "gas-cylinder",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 20,
        "name": "Gave it to Abi",
        "type": "expense",
        "icon": "bank-transfer-out",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 21,
        "name": "Gifts",
        "type": "expense",
        "icon": "gift",
        "color": "#EC4899",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 22,
        "name": "Groceries",
        "type": "expense",
        "icon": "cart",
        "color": "#F97316",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 23,
        "name": "Guest Visit to Bangalore",
        "type": "expense",
        "icon": "account-group-outline",
        "color": "#6366F1",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 24,
        "name": "Home Improvement",
        "type": "expense",
        "icon": "hammer-wrench",
        "color": "#A16207",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 25,
        "name": "Hospital / Medicine",
        "type": "expense",
        "icon": "hospital-box-outline",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 26,
        "name": "Households",
        "type": "expense",
        "icon": "bus-stop-covered",
        "color": "#14B8A6",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 27,
        "name": "Interest",
        "type": "income",
        "icon": "percent",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 28,
        "name": "Jewellery",
        "type": "expense",
        "icon": "gold",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 29,
        "name": "Loan / EMI",
        "type": "expense",
        "icon": "bank-transfer",
        "color": "#B91C1C",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 30,
        "name": "Misc",
        "type": "expense",
        "icon": "dots-horizontal",
        "color": "#9CA3AF",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 31,
        "name": "Mobile",
        "type": "expense",
        "icon": "cellphone",
        "color": "#0EA5E9",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 32,
        "name": "Mobile Recharge",
        "type": "expense",
        "icon": "cellphone",
        "color": "#0EA5E9",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 33,
        "name": "Money Given",
        "type": "expense",
        "icon": "arrow-up-bold-circle",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 34,
        "name": "Money Received",
        "type": "income",
        "icon": "arrow-down-bold-circle",
        "color": "#10B981",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 35,
        "name": "Parents",
        "type": "expense",
        "icon": "account-group",
        "color": "#FB923C",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 36,
        "name": "Printing & Stationery",
        "type": "expense",
        "icon": "printer",
        "color": "#6B7280",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 37,
        "name": "Relatives",
        "type": "expense",
        "icon": "account-group",
        "color": "#F97316",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 38,
        "name": "Rent",
        "type": "expense",
        "icon": "home-account",
        "color": "#3B82F6",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 39,
        "name": "Salary",
        "type": "income",
        "icon": "cash-multiple",
        "color": "#16A34A",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 40,
        "name": "Salon",
        "type": "expense",
        "icon": "content-cut",
        "color": "#334155",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:11"
      },
      {
        "id": 41,
        "name": "Sandals / Shoes",
        "type": "expense",
        "icon": "shoe-sneaker",
        "color": "#DB2777",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 42,
        "name": "Savings",
        "type": "expense",
        "icon": "piggy-bank",
        "color": "#059669",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 43,
        "name": "Snacks",
        "type": "expense",
        "icon": "food-variant",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 44,
        "name": "Special Occasions",
        "type": "expense",
        "icon": "party-popper",
        "color": "#06B6D4",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 45,
        "name": "Transport",
        "type": "expense",
        "icon": "bus",
        "color": "#14B8A6",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 46,
        "name": "Utilities",
        "type": "expense",
        "icon": "lightning-bolt",
        "color": "#64748B",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 47,
        "name": "Vacation",
        "type": "expense",
        "icon": "earth",
        "color": "#A3E635",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 48,
        "name": "Wallet Transfer",
        "type": "expense",
        "icon": "swap-horizontal",
        "color": "#6366F1",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      },
      {
        "id": 49,
        "name": "Water / Purifier",
        "type": "expense",
        "icon": "cup-water",
        "color": "#64748B",
        "is_active": 1,
        "created_at": "2026-07-03 10:12:12"
      }
    ],
    sources: [
      {
        "name": "Axis Bank",
        "type": null,
        "initial_balance": 0,
        "icon": "bank",
        "color": "#DC2626",
        "id": 1
      },
      {
        "name": "Bank of Baroda",
        "type": null,
        "initial_balance": 0,
        "icon": "bank",
        "color": "#6366F1",
        "id": 2
      },
      {
        "name": "Cash",
        "type": null,
        "initial_balance": 0,
        "icon": "cash",
        "color": "#A3E635",
        "id": 3
      },
      {
        "name": "State Bank of India",
        "type": null,
        "initial_balance": 0,
        "icon": "bank",
        "color": "#6366F1",
        "id": 4
      }
    ],
    budgets: [],
    bills: []
  }
};

fs.writeFileSync(
  "2018_12_income.json",
  JSON.stringify(backup, null, 2),
  "utf8"
);

console.log("2018_12_income.json created successfully.");
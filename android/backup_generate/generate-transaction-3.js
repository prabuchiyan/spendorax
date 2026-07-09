const fs = require("fs");

const raw = `
01/10/18 : Grocery : $2212

01/10/18 : Room Rent : $9000

01/10/18 : Lunch : $35

01/10/18 : Bike Air : $3

01/10/18 : Petrol : $400

04/10/18 : Added to Paytm : $600

05/10/18 : Personal Loan : $4917

05/10/18 : Lunch : $30

05/10/18 : Snacks : $10

05/10/18 : Lunch : $50

05/10/18 : 96 Movie : $150

06/10/18 : Drinks : $467

06/10/18 : Mutton : $200

06/10/18 : Coriander & Ginger : $6

08/10/18 : Recharge BSNL : $49

09/10/18 : Lunch : $30

09/10/18 : Dinner : $30

10/10/18 : Lunch : $30

11/10/18 : Water Bill : $400

12/10/18 : Bus : Pudukkottai to Bangalore : $1660

13/10/18 : Bus : Hosur to Bangalore : $60

17/10/18 : Train : Bangalore to Thanjavur : $60

17/10/18 : Lunch : $100

17/10/18 : Rasagulla & Soanpapdi : $247

18/10/18 : Bus : Room to Office : $17

18/10/18 : Added to Paytm : $600

18/10/18 : Snacks : $10

18/10/18 : Bus : Bangalore to Salem : $230

18/10/18 : Dinner : $40

18/10/18 : Bus : Salem to Trichy : $122

19/10/18 : Bus : Trichy to Thanjavur : $43

19/10/18 : Bus : Thanjavur New Bus Stand to Old Bus Stand : $10

19/10/18 : Group Photos : $200

19/10/18 : Petrol For Abi Dad : $100

19/10/18 : Bike Parking : $5

19/10/18 : Cheppal Token : $5

19/10/18 : For God : $8

19/10/18 : Normal Baby Checkup & Medicine : $350

20/10/18 : Ola Wallet Money Added : $200

20/10/18 : Water Pocket : $9

21/10/18 : Bus : Thanjavur to Pudukkottai : $90

21/10/18 : Auto : Pudukkottai Bus Stand to Home : $70

21/10/18 : Snacks For Akka Family : $180

21/10/18 : Gift to Prasanna Function : $100

21/10/18 : Petrol For Akka : $50

22/10/18 : Lunch : $30

24/10/18 : Lunch : $30

24/10/18 : Bike Petrol : $400

25/10/18 : Lunch : $30

25/10/18 : Chips : $60

26/10/18 : Lunch : $40

26/10/18 : Eggs : $30

27/10/18 : Dinner : $76.92

28/10/18 : Drinks : $899

28/10/18 : Again Drinks : $10

28/10/18 : Cigarettes : $45

29/10/18 : Breakfast : $20

29/10/18 : Lunch : $10

29/10/18 : Lassie : $30

29/10/18 : Idly : $30

30/10/18 : Breakfast : $30

30/10/18 : Lunch : $30

30/10/18 : Photos & Video Coverage : $15000

31/10/18 : Breakfast : $25

31/10/18 : Lunch : $40
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
  "Grocery": 23,
  "Vegetables": 23,
  "Vegetables & Fruits": 23,
  "Vegetables & Chicken": 23,
  "Mutton & Vegetables": 23,
  "Milk": 23,
  "Milk & Dry chilli": 23,
  "Milk & Currie Leaves": 23,
  "10Eggs": 23,
  "Egg and washing soap": 23,
  "Carrot": 23,
  "Carrots": 23,
  "Carrots ": 23,
  "Carrots, Eggs & Banana": 23,
  "Cashew and Dry Grapes": 23,
  "Chicken, Masala & Coriander": 23,
  "Beans, Rice, Pickle & Biscuits": 23,
  "Black Gram": 23,
  "Black Gram 1/4kg": 23,
  "Bread, Jam, Water cane": 23,
  "Cinthol Soaps": 23,
  "Coconut": 23,
  "Cooking Oil": 23,
  "Dandruff Shampoo": 23,
  "Dates & Ice Cream": 23,
  "Dhall & Chilli": 23,
  "Dustbin Cover": 23,
  "Flour Mix": 23,
  "Flour, Oil & Soaps": 23,
  "Ice Cream & Washing Powder": 23,
  "Idly Rice": 23,
  "Plastic Bag": 23,
  "Salt & Coffee Powder": 23,
  "Shampoo": 23,
  "Spinach, Coconut & Tomatoes": 23,
  "Tender Coconut": 23,

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

  // Child Birth
  "Pregnancy Test": 6,

  // Medical
  "Cold Medicine": 26,
  "Eye Ointment": 26,
  "Hospital Bill": 26,
  "Medical Bill": 26,
  "Medicare Shampoo": 26,

  // Households
  "House Holds": 27,
  "Household Things": 27,
  "Households": 27,
  "Knife & Washing Brush": 27,
  "Tiffan Box": 27,

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

  // Clothes
  "Dress": 7,
  "Jacket & Inner For Abi": 7,
  "Purchase Pant": 7,
  "Purchase Shirt": 7,

  // Sandals / Shoes
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
  "Mobile Back Cover": 32,
  "Back Cover": 32,
  "Recharge": 32,
  "Recharge Airtel": 32,
  "Recharge For Abi": 32,
  "Recharge For Mom": 32,
  "Recharge to Airtel": 32,
  "DTH Recharge": 32,
  "Mi Mobile Service Tax": 32,
  "Screen Card": 32,
  "Sim Card": 32,
  "Sim Card & Link Adhaar": 32,

  // Loan
  "Bike EMI": 30,
  "Personal Loan EMI": 30,
  "Capital First Loan Paid": 30,
  "Spend for Loan": 30,
  "Bang Sony TV 32 Inch: Auto Debit": 30,

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
  "Found it From Home": 34,
  "Get it From Eniyan": 34,
  "Get it From Sister": 34,
  "Get it From Akka": 34,
  "Get it From Son": 34,
  "Get it From Wife": 34,

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
  "Salary": 39,

  // Cashback
  "Get it From Tez": 5,
  "Petrol Surcharge": 5,

  //Interest
  "Interest": 28,

  // Personal Care
  "Haircut": 40,
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
  "Default_expense": 31,
  "Default_income": 34
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
    const type = "expense"; // expense OR income
    const [, date, notes, amountStr] = match;
    const [dd, mm, yy] = date.split("/");
    const formattedDate = `20${yy}-${mm}-${dd}`;
    return {
      id: id++,
      type,
      amount: Number(amountStr.trim()),
      category_id: categoryMap[notes] ?? (type === "income"
        ? categoryMap.Default_income
        : categoryMap.Default_expense),
      source_id: type === 'income' ? 1 : 3,
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
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 50,
        "name": "Anniversary",
        "type": "expense",
        "icon": "ring",
        "color": "#E91E63",
        "is_active": 1,
        "created_at": "2026-07-09 10:52:07"
      },
      {
        "id": 2,
        "name": "Bank Charges",
        "type": "expense",
        "icon": "bank",
        "color": "#374151",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 3,
        "name": "Beauty Care",
        "type": "expense",
        "icon": "cards-heart-outline",
        "color": "#DB2777",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 4,
        "name": "Bike / Vehicle",
        "type": "expense",
        "icon": "motorbike",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 5,
        "name": "Cashback",
        "type": "income",
        "icon": "cash-plus",
        "color": "#A3E635",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 6,
        "name": "Child Birth",
        "type": "expense",
        "icon": "baby-carriage",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 7,
        "name": "Clothes",
        "type": "expense",
        "icon": "tshirt-v",
        "color": "#FB923C",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 8,
        "name": "DTH",
        "type": "expense",
        "icon": "television-play",
        "color": "#8B5CF6",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 9,
        "name": "Diwali",
        "type": "expense",
        "icon": "firework",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 10,
        "name": "Donations",
        "type": "expense",
        "icon": "hand-heart",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 11,
        "name": "Drinks",
        "type": "expense",
        "icon": "liquor",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 12,
        "name": "Electricity",
        "type": "expense",
        "icon": "power-plug",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 13,
        "name": "Electronics",
        "type": "expense",
        "icon": "devices",
        "color": "#A78BFA",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 14,
        "name": "Eniyan",
        "type": "expense",
        "icon": "human-female-dance",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 15,
        "name": "Entertainment",
        "type": "expense",
        "icon": "movie-open",
        "color": "#7C3AED",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 16,
        "name": "Family",
        "type": "expense",
        "icon": "account-group",
        "color": "#F43F5E",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 17,
        "name": "Food & Dining",
        "type": "expense",
        "icon": "silverware-fork-knife",
        "color": "#F59E0B",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 18,
        "name": "Fruits",
        "type": "expense",
        "icon": "fruit-watermelon",
        "color": "#84CC16",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 19,
        "name": "Gas",
        "type": "expense",
        "icon": "gas-cylinder",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 20,
        "name": "Gave it to Abi",
        "type": "expense",
        "icon": "bank-transfer-out",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 21,
        "name": "Gifts",
        "type": "expense",
        "icon": "gift",
        "color": "#EC4899",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 23,
        "name": "Gold Loan",
        "type": "expense",
        "icon": "necklace",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 23,
        "name": "Groceries",
        "type": "expense",
        "icon": "cart",
        "color": "#F97316",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 24,
        "name": "Guest Visit to Bangalore",
        "type": "expense",
        "icon": "account-group-outline",
        "color": "#6366F1",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 25,
        "name": "Home Improvement",
        "type": "expense",
        "icon": "hammer-wrench",
        "color": "#A16207",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 26,
        "name": "Hospital / Medicine",
        "type": "expense",
        "icon": "hospital-box-outline",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 27,
        "name": "Households",
        "type": "expense",
        "icon": "bus-stop-covered",
        "color": "#14B8A6",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 28,
        "name": "Interest",
        "type": "income",
        "icon": "percent",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 29,
        "name": "Jewellery",
        "type": "expense",
        "icon": "gold",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 30,
        "name": "Loan / EMI",
        "type": "expense",
        "icon": "bank-transfer",
        "color": "#B91C1C",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 31,
        "name": "Misc",
        "type": "expense",
        "icon": "dots-horizontal",
        "color": "#9CA3AF",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 32,
        "name": "Mobile",
        "type": "expense",
        "icon": "cellphone",
        "color": "#0EA5E9",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 33,
        "name": "Money Given",
        "type": "expense",
        "icon": "arrow-up-bold-circle",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 34,
        "name": "Money Received",
        "type": "income",
        "icon": "arrow-down-bold-circle",
        "color": "#10B981",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 35,
        "name": "Parents",
        "type": "expense",
        "icon": "account-group",
        "color": "#FB923C",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 36,
        "name": "Printing & Stationery",
        "type": "expense",
        "icon": "printer",
        "color": "#6B7280",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 37,
        "name": "Relatives",
        "type": "expense",
        "icon": "account-group",
        "color": "#F97316",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 38,
        "name": "Rent",
        "type": "expense",
        "icon": "home-account",
        "color": "#3B82F6",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 39,
        "name": "Salary",
        "type": "income",
        "icon": "cash-multiple",
        "color": "#16A34A",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 40,
        "name": "Salon",
        "type": "expense",
        "icon": "content-cut",
        "color": "#334155",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 41,
        "name": "Sandals / Shoes",
        "type": "expense",
        "icon": "shoe-sneaker",
        "color": "#DB2777",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 42,
        "name": "Savings",
        "type": "expense",
        "icon": "piggy-bank",
        "color": "#059669",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 43,
        "name": "Snacks",
        "type": "expense",
        "icon": "food-variant",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 44,
        "name": "Special Occasions",
        "type": "expense",
        "icon": "party-popper",
        "color": "#06B6D4",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 45,
        "name": "Transport",
        "type": "expense",
        "icon": "bus",
        "color": "#14B8A6",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 46,
        "name": "Utilities",
        "type": "expense",
        "icon": "lightning-bolt",
        "color": "#64748B",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 47,
        "name": "Vacation",
        "type": "expense",
        "icon": "earth",
        "color": "#A3E635",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 48,
        "name": "Wallet Transfer",
        "type": "expense",
        "icon": "swap-horizontal",
        "color": "#6366F1",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      },
      {
        "id": 49,
        "name": "Water / Purifier",
        "type": "expense",
        "icon": "cup-water",
        "color": "#64748B",
        "is_active": 1,
        "created_at": "2026-07-09 08:19:40"
      }
    ],
    "sources": [
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
        "color": "#FB923C",
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
  "2018_10.json",
  JSON.stringify(backup, null, 2),
  "utf8"
);

console.log("2018_10.json created successfully.");
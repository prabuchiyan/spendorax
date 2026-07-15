const fs = require("fs");

const raw = `
01/06/19 : Room Rent : $9450

01/06/19 : Chicken : $100

01/06/19 : Chilli : $10

01/06/19 : Mint & Coriander : $10

01/06/19 : Eggs : $50

02/06/19 : Milk : $20

02/06/19 : Biscuits : $10

02/06/19 : Tomatoes : $25

02/06/19 : Vegetables : $180

02/06/19 : Plums : $50

02/06/19 : Ice Cream : $40

02/06/19 : Son Car Ride : $40

02/06/19 : Corn Phel : $45

02/06/19 : Chocolate : $110

03/06/19 : Recharge For Me : $380

03/06/19 : Bananas : $30

03/06/19 : Vadai & Samosa : $40

03/06/19 : Milk : $20

03/06/19 : DTH Recharge For Pdkt : $50

04/06/19 : Recurring Deposit : $2500

04/06/19 : Lunch : $30

04/06/19 : Bus : Bangalore to Pudukkottai : $501

04/06/19 : Bus : Pudukkottai to Bangalore : $605

04/06/19 : Bus : Pudukkottai to Bangalore : $605

04/06/19 : Milk : $21

04/06/19 : Gilabi : $30

05/06/19 : Gave it to Abi : $200

05/06/19 : Sugar : $20

06/06/19 : Annual Charges For Vijaya Card  : $177

06/06/19 : Milk : $20

06/06/19 : Fever Medicine : $60

06/06/19 : Biscuits & Snacks : $25

07/06/19 : Logesh Son Birthday Gift : $100

07/06/19 : Milk : $21

07/06/19 : Wall Clock Battery : $10

08/06/19 : Donated : $5

08/06/19 : Coffee : $50

08/06/19 : Groundnuts Candy : $30

08/06/19 : Murukku : $35

08/06/19 : Cake : $30

09/06/19 : Auto : Bus Stand to Pdkt Home : $70

09/06/19 : Gave it to Abi : $300

09/06/19 : Bus : Pudukkottai to Trichy : $50

09/06/19 : Bus : Trichy to Salem : $125

10/06/19 : Bus : Salem to Bangalore : $225

10/06/19 : Recharge For Abi : $324

10/06/19 : Lunch : $50

10/06/19 : Dinner : $30

11/06/19 : Lunch : $30

11/06/19 : Fruit Bowl : $20

11/06/19 : Dinner : $35

12/06/19 : Gave it to Abi : $200

12/06/19 : Lunch : $60

12/06/19 : Dinner : $30

13/06/19 : Electricity Bill : $457

13/06/19 : Lunch : $30

13/06/19 : Dinner : $30

14/06/19 : Lunch : $30

14/06/19 : Fruit Bowl : $20

15/06/19 :  Mahesh Ooru Thiruvizha : Bike Petrol : $200

15/06/19 :  Mahesh Ooru Thiruvizha : Cool Drinks : $45

15/06/19 :  Mahesh Ooru Thiruvizha : Spend For Drinks : $140

15/06/19 : Mahesh Ooru Thiruvizha : Bike Petrol : $100

15/06/19 : Mahesh Ooru Thiruvizha : Dinner : $178

16/06/19 : Gift For Shivani & Shresha : $135

16/06/19 : Snacks For Shivani & Shresha :$10

16/06/19 : Tablet For Akka : $20

17/06/19 : DTH Recharge to Pdkt : $139

17/06/19 : Pdkt Shop Electricity : $1161

17/06/19 : Pdkt Home Electricity : $470

17/06/19 : Gave it to Akka : $1000

17/06/19 : Thanjavur Trip : Bus Fare : $180

17/06/19 : Thanjavur Trip : Cab Fare : $189

17/06/19 : Thanjavur Trip : Dinner : $263

18/06/19 : Bus : Thanjavur to Bangalore : $465.25

18/06/19 : Thanjavur Trip : Cool Drinks : $100

18/06/19 : Birthday Cloths For Eniyan : $2230

18/06/19 : Thanjavur Trip : Cool Drinks : $40

18/06/19 : Purchased Pillows : $220

18/06/19 : Thanjavur Trip : Bike Petrol  : $100

19/06/19 : Gave it to Abi : $200

19/06/19 : Lunch : $40

19/06/19 : Groundnuts : $10

19/06/19 : Dinner : $70

20/06/19 : Money Added to Paytm : $200

20/06/19 : Lunch : $40

20/06/19 : Bike Petrol : $300

20/06/19 : Bike Air : $3

20/06/19 : Dinner : $115

20/06/19 : Milk : $22

21/06/19 : Debited From SBI : $12

21/06/19 : Lunch : $30

21/06/19 : Groundnuts : $10

21/06/19 : Shawarma Roll : $90

21/06/19 : Tomatoes : $10

21/06/19 : Eggs : $57

21/06/19 : Rice : $40

22/06/19 : Chicken Biriyani : $353

22/06/19 : Drinks : $656

24/06/19 : Lunch : $30

24/06/19 : Shorts : $400

24/06/19 : Shampoo & Sigaikkai : $10

25/06/19 : Lunch : $30

25/06/19 : Snacks : $25

29/06/19 : Bus : Bangalore to Pudukkottai : $683

29/06/19 : Gave it to Abi : $200

29/06/19 : Groceries From Grofers : $1378

30/06/19 : Bracelet Gift For Son : $16000

30/06/19 : Bike Petrol : $100

30/06/19 : Birthday Function Food : $10000

30/06/19 : Birthday Cake : $1100

30/06/19 : Drinks Party for Son : $640

30/06/19 : Egg Mushrooms : $60

30/06/19 : Birthday Decorations : $640

30/06/19 : Drinks Party for Son : $1265

30/06/19 : Party Cigarettes : $87

30/06/19 : Party Food : $146

30/06/19 : Ice Cream : $170
`;

const categoryMap = {
  // Bank Charges
  "Consolidate Charges": 3,

  // Vehicle
  "Petrol": 5,
  "Bike Petrol": 5,
  "Petrol & Air": 5,
  "Bike Air": 5,
  "Bike Parking": 5,
  "Helmet": 5,
  "Pulsar: Bike Repair": 5,
  "Royal Enfield: Service": 5,
  "Royal Enfield: Service & Insurance": 5,
  "Water Wash": 5,
  "Petrol Air": 5,

  // Cashback
  "Get it From Tez": 6,
  "Petrol Surcharge": 6,

  // Child Birth
  "Pregnancy Test": 7,

  // Clothes
  "Dress": 8,
  "Jacket & Inner For Abi": 8,
  "Purchase Pant": 8,
  "Purchase Shirt": 8,
  "Clothes": 8,

  // Eniyan
  "Pampers": 15,

  // DTH
  "DTH Recharge": 33,
  "Dth Recharge": 33,

  // Donations
  "Donated": 11,

  // Drinks
  "Sarakku": 12,
  "Cigarettes & Candy": 12,
  "Cigarettes": 12,

  // Utilities
  "Electricity Bill": 13,
  "Pdkt Home Electricity Bill": 13,

  // Electronics
  "Watch Pin": 14,
  "Purchased UPS": 14,
  "Bang Sony TV 32 Inch: Bajaj Card": 14,
  "Bang Sony TV 32 Inch: Initial Amount": 14,
  "Bang Sony TV 32 Inch: Proof Approval": 14,
  "Bang Sony TV 32 Inch: Stabilizer": 14,

  // Entertainment
  "Movie": 16,
  "Party": 16,
  "Park": 16,
  "Park & Parking": 16,
  "Exhibition": 16,
  "Bike Parking in Theatre": 16,

  // Food & Dining
  "Breakfast": 18,
  "Lunch": 18,
  "Lunch : Briyani": 18,
  "Dinner": 18,
  "Dinner ": 18,
  "Dinner​": 18,
  "Dinner Purchase": 18,
  "Burger & Nuggets": 18,
  "Noodles": 18,
  "Biriyani": 18,
  "Biriyani & Tandoori": 18,
  "Tandoori": 18,

  // Fruits
  "Fruits": 19,
  "Apple & Orange": 19,
  "Grapes": 19,
  "Papaya": 19,
  "Pomegranate": 19,
  "Bananas": 19,
  "Pineapple": 19,
  "Sappotta": 19,
  "Watermelon": 19,
  "Mangoes": 19,

  // Gas
  "Gas": 20,

  // Gift
  "Gift": 22,
  "Birthday Gift": 22,
  "Birthday Cake": 22,
  "Birthday Presents": 22,
  "Henry Marriage Gift": 22,
  "Priya Adhiyamaan Marriage Gift": 22,
  "Send Off": 22,

  // Groceries
  "Grocery": 24,
  "Vegetables": 24,
  "Vegetables & Fruits": 24,
  "Vegetables & Chicken": 24,
  "Mutton & Vegetables": 24,
  "Milk": 24,
  "Milk & Dry chilli": 24,
  "Milk & Currie Leaves": 24,
  "10Eggs": 24,
  "Egg and washing soap": 24,
  "Carrot": 24,
  "Carrots": 24,
  "Carrots ": 24,
  "Carrots, Eggs & Banana": 24,
  "Cashew and Dry Grapes": 24,
  "Chicken, Masala & Coriander": 24,
  "Beans, Rice, Pickle & Biscuits": 24,
  "Black Gram": 24,
  "Black Gram 1/4kg": 24,
  "Bread, Jam, Water cane": 24,
  "Cinthol Soaps": 24,
  "Coconut": 24,
  "Cooking Oil": 24,
  "Dandruff Shampoo": 24,
  "Dates & Ice Cream": 24,
  "Dhall & Chilli": 24,
  "Dustbin Cover": 24,
  "Flour Mix": 24,
  "Flour, Oil & Soaps": 24,
  "Ice Cream & Washing Powder": 24,
  "Idly Rice": 24,
  "Plastic Bag": 24,
  "Salt & Coffee Powder": 24,
  "Shampoo": 24,
  "Spinach, Coconut & Tomatoes": 24,
  "Tender Coconut": 24,
  "Eggs": 24,
  "Egg": 24,
  "Napkins": 24,
  "Pottukadalai": 24,
  "Black Grams": 24,
  "Curd": 24,
  "Sigaikkai": 24,
  "Corn flour": 24,
  "Corn Flour": 24,
  "Capsicum": 24,
  "Maida": 24,
  "Gee & Raisin": 24,
  "Gee": 24,
  "Raisin": 24,
  "Mutton": 24,
  "Groceries - Grofers": 24,
  "Groceries - Flipkart": 24,
  "Sugar": 24,
  "Turmeric Powder": 24,
  "Refined Oil": 24,
  "Maida & Keshari Powder": 24,
  "Sunflower Oil": 24,
  "Onions": 24,
  "Pattani & Sugar": 24,
  "Pattani": 24,
  "Tea Powder": 24,
  "Vegetables & Groceries": 24,
  "Groceries": 24,
  "Tomatoes": 24,
  "Idly Rice & Noodles Masala": 24,
  "Noodles Masala": 24,

  // Medical
  "Cold Medicine": 27,
  "Eye Ointment": 27,
  "Hospital Bill": 27,
  "Medical Bill": 27,
  "Medicare Shampoo": 27,
  "Fever Medicine": 27,
  "Fever Medicine": 27,
  "Doctor Fees": 27,
  "Tonics": 27,

  // Households
  "House Holds": 28,
  "Household Things": 28,
  "Households": 28,
  "Knife & Washing Brush": 28,
  "Tiffan Box": 28,

  //Interest
  "Interest": 29,

  // Loan
  "Bike EMI": 31,
  "Personal Loan EMI": 31,
  "Capital First Loan Paid": 31,
  "Spend for Loan": 31,
  "Bang Sony TV 32 Inch: Auto Debit": 31,

  // Mobile
  "Mobile Back Cover": 33,
  "Back Cover": 33,
  "Recharge": 33,
  "Recharge Airtel": 33,
  "Recharge For Abi": 33,
  "Recharge For Mom": 33,
  "Recharge to Airtel": 33,
  "Mi Mobile Service Tax": 33,
  "Screen Card": 33,
  "Sim Card": 33,
  "Sim Card & Link Adhaar": 33,
  "Abi Phone Cover": 33,

  // Money Given
  "Give it Back": 34,
  "Give it back": 34,
  "Give it back Sasi": 34,
  "Give it Back Vivek": 34,
  "Give it Back Vetrivel": 34,
  "Give back": 34,
  "Give back ": 34,
  "Give back to Deepak": 34,
  "Give back to Dinesh": 34,
  "Give back to KD": 34,
  "Give back to Madhu": 34,
  "Give back to Naveen": 34,
  "Gave it Back": 34,
  "Gave it to Ravi": 34,
  "Gave to Ravi": 34,
  "Gave to Naveen": 34,
  "Gave to Mom": 34,
  "Gave to Ram": 34,
  "Gave to Sasi": 34,
  "Gave to Dinesh": 34,
  "Gave to Akka": 34,
  "Gave to Madhu": 34,
  "Gave to Aboo": 34,
  "Gave to": 34,
  "Gave it to Abi": 34,
  "Gave it to Boopathi": 34,
  "Give it Back to Abi": 34,
  "Give Back to Abi": 34,
  "Give it to Abi": 34,

  // Money Received
  "Get it From Abi": 35,
  "Get it From Dad": 35,
  "Get it From Mom": 35,
  "Get it From Naveen": 35,
  "Get it From Ramya": 35,
  "Get it From Ravi": 35,
  "Get it From Vetrivel": 35,
  "Get it From Vivek": 35,
  "Get it From Dinesh": 35,
  "Get it From Mams": 35,
  "Get it From Bag": 35,
  "Get it From Thali Pirichu Potta Function": 35,
  "Get From Deepak": 35,
  "Get From Dinesh": 35,
  "Get From Sasi": 35,
  "Get From Shufil": 35,
  "Lunch Amount": 35,
  "Room Advance Returned ": 35,
  "Available Amount ": 35,
  "Found it From Home": 35,
  "Get it From Eniyan": 35,
  "Get it From Sister": 35,
  "Get it From Akka": 35,
  "Get it From Son": 35,
  "Get it From Wife": 35,

  // Rent
  "Room Rent": 39,
  "Room: Rent": 39,
  "Room Advance": 39,
  "Room Advance Returned": 39,
  "Room Rental Agreement": 39,
  "Room Shifting": 39,
  "Room: EB Deposit": 39,
  "Room: Electricity Bill": 39,
  "Room: Internet Bill": 39,
  "Room: Water": 39,
  "Room: Water Bill": 39,
  "Room: Water Cane": 39,
  "Room: Hit Purchase": 39,
  "Room: Spend": 39,
  "House Warming": 39,
  "Give Back to Dinesh & Room Rent": 39,
  "Water Bill": 39,
  "Room Rent & Water Bill": 39,

  // Salary
  "March Month 2017": 40,
  "April Month 2017": 40,
  "May Month 2017": 40,
  "June Month 2017": 40,
  "July Month 2017": 40,
  "August Month 2017": 40,
  "September Month 2017": 40,
  "October Month 2017": 40,
  "Salary": 40,

  // Saloon
  "Haircut": 41,
  "Hair Cut": 41,
  "Hair Cut For Abi": 41,
  "Hair Cut For Myself ": 41,
  "Hair Cut For Myself  ": 41,

  // Sandals / Shoes
  "Sandals": 42,

  // Savings
  "RD": 43,
  "Rd": 43,
  "FD": 43,
  "Recurring Deposit": 43,
  "Recurring Deposit ": 43,
  "Recurrent Deposit": 43,

  // Snacks
  "Snack": 44,
  "Snacks": 44,
  "Evening Snacks": 44,
  "Dinner Snacks": 44,
  "Dinner Snacks & Parking": 44,
  "Bakery Snacks": 44,
  "Chocolate": 44,
  "Cool Drinks": 44,
  "Juice": 44,
  "Lattu & Food": 44,
  "Rusk": 44,
  "Snacks For Abi": 44,
  "Snacks Spend": 44,
  "Sweets": 44,
  "Water Bottles": 44,
  "Biscuits": 44,
  "Fruit Bowl": 44,
  "Sprite": 44,
  "Uppattu": 44,
  "Lattu": 44,
  "Nenthra Chips": 44,
  "Pepsi": 44,
  "Gobi Manchurian": 44,
  "Kadalamittai": 44,
  "Vadai": 44,
  "Coffee": 44,
  "Egg Buffs & Kulfi": 44,
  "Egg Buffs": 44,
  "Samosa &Vadai": 44,
  "Samosa & Vadai": 44,
  "Samosa": 44,
  "Samosas": 44,
  "Chips & Murukku": 44,
  "Chips & Mutukku": 44,
  "Murukku": 44,
  "Chips": 44,
  "Masala Groundnuts": 44,
  "Vadai & Egg Bonda": 44,
  "Egg Bonda": 44,
  "Shawarma": 44,
  "Sprite Cook Drinks": 44,
  "Kulfi": 44,
  "Butter Milk": 44,
  "Ice Cream": 44,

  // Travel
  "Trip Amount": 48,
  "Thirupathi Trip": 48,
  "Bennargetta Zoo Spend": 48,
  "Lalbagh": 48,
  "Lalbagh Tickets": 48,
  "Bus : Lalbagh to Room": 48,
  "Bus : Room to Lalbagh": 48,
  "Shiradi: Expenses": 48,
  "Shiradi: Bus Booking & Others": 48,
  "Bus : Bangalore to Pudukkottai": 48,
  "Bus: Bangalore to Pudukkottai": 48,

  // Wallet Transfer
  "Uber Wallets": 49,

  // Water
  "Water Cane": 50,

  // Default
  "Default_expense": 32,
  "Default_income": 35
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
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 2,
        "name": "Anniversary",
        "type": "expense",
        "icon": "ring",
        "color": "#E91E63",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 3,
        "name": "Bank Charges",
        "type": "expense",
        "icon": "bank",
        "color": "#374151",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 4,
        "name": "Beauty Care",
        "type": "expense",
        "icon": "cards-heart-outline",
        "color": "#DB2777",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 5,
        "name": "Bike / Vehicle",
        "type": "expense",
        "icon": "motorbike",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 6,
        "name": "Cashback",
        "type": "income",
        "icon": "cash-plus",
        "color": "#A3E635",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 7,
        "name": "Child Birth",
        "type": "expense",
        "icon": "baby-carriage",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 8,
        "name": "Clothes",
        "type": "expense",
        "icon": "tshirt-v",
        "color": "#FB923C",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 9,
        "name": "DTH",
        "type": "expense",
        "icon": "television-play",
        "color": "#8B5CF6",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 10,
        "name": "Diwali",
        "type": "expense",
        "icon": "firework",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 11,
        "name": "Donations",
        "type": "expense",
        "icon": "hand-heart",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 12,
        "name": "Drinks",
        "type": "expense",
        "icon": "liquor",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 13,
        "name": "Electricity",
        "type": "expense",
        "icon": "power-plug",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 14,
        "name": "Electronics",
        "type": "expense",
        "icon": "devices",
        "color": "#A78BFA",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:03"
      },
      {
        "id": 15,
        "name": "Eniyan",
        "type": "expense",
        "icon": "human-female-dance",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 16,
        "name": "Entertainment",
        "type": "expense",
        "icon": "movie-open",
        "color": "#7C3AED",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 17,
        "name": "Family",
        "type": "expense",
        "icon": "account-group",
        "color": "#F43F5E",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 18,
        "name": "Food & Dining",
        "type": "expense",
        "icon": "silverware-fork-knife",
        "color": "#F59E0B",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 19,
        "name": "Fruits",
        "type": "expense",
        "icon": "fruit-watermelon",
        "color": "#84CC16",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 20,
        "name": "Gas",
        "type": "expense",
        "icon": "gas-cylinder",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 21,
        "name": "Gave it to Abi",
        "type": "expense",
        "icon": "bank-transfer-out",
        "color": "#DC2626",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 22,
        "name": "Gifts",
        "type": "expense",
        "icon": "gift",
        "color": "#EC4899",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 23,
        "name": "Gold Loan",
        "type": "expense",
        "icon": "necklace",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 24,
        "name": "Groceries",
        "type": "expense",
        "icon": "cart",
        "color": "#F97316",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 25,
        "name": "Guest Visit to Bangalore",
        "type": "expense",
        "icon": "account-group-outline",
        "color": "#6366F1",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 51,
        "name": "Hair Maintenance",
        "type": "expense",
        "icon": "face-man-shimmer",
        "color": "#334155",
        "is_active": 1,
        "created_at": "2026-07-12 18:10:39"
      },
      {
        "id": 26,
        "name": "Home Improvement",
        "type": "expense",
        "icon": "hammer-wrench",
        "color": "#A16207",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 27,
        "name": "Hospital / Medicine",
        "type": "expense",
        "icon": "hospital-box-outline",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 28,
        "name": "Households",
        "type": "expense",
        "icon": "bus-stop-covered",
        "color": "#14B8A6",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 29,
        "name": "Interest",
        "type": "income",
        "icon": "percent",
        "color": "#22C55E",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 30,
        "name": "Jewellery",
        "type": "expense",
        "icon": "gold",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 31,
        "name": "Loan / EMI",
        "type": "expense",
        "icon": "bank-transfer",
        "color": "#B91C1C",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 32,
        "name": "Misc",
        "type": "expense",
        "icon": "dots-horizontal",
        "color": "#9CA3AF",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 33,
        "name": "Mobile",
        "type": "expense",
        "icon": "cellphone",
        "color": "#0EA5E9",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 34,
        "name": "Money Given",
        "type": "expense",
        "icon": "arrow-up-bold-circle",
        "color": "#EF4444",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 35,
        "name": "Money Received",
        "type": "income",
        "icon": "arrow-down-bold-circle",
        "color": "#10B981",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 36,
        "name": "Parents",
        "type": "expense",
        "icon": "account-group",
        "color": "#FB923C",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 52,
        "name": "Prabu Birthday",
        "type": "expense",
        "icon": "cake-layered",
        "color": "#3B82F6",
        "is_active": 1,
        "created_at": "2026-07-12 18:15:00"
      },
      {
        "id": 37,
        "name": "Printing & Stationery",
        "type": "expense",
        "icon": "printer",
        "color": "#6B7280",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 38,
        "name": "Relatives",
        "type": "expense",
        "icon": "account-group",
        "color": "#F97316",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 39,
        "name": "Rent",
        "type": "expense",
        "icon": "home-account",
        "color": "#3B82F6",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 40,
        "name": "Salary",
        "type": "income",
        "icon": "cash-multiple",
        "color": "#16A34A",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 41,
        "name": "Salon",
        "type": "expense",
        "icon": "content-cut",
        "color": "#334155",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 42,
        "name": "Sandals / Shoes",
        "type": "expense",
        "icon": "shoe-sneaker",
        "color": "#DB2777",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 43,
        "name": "Savings",
        "type": "expense",
        "icon": "piggy-bank",
        "color": "#059669",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 44,
        "name": "Snacks",
        "type": "expense",
        "icon": "food-variant",
        "color": "#FBBF24",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 45,
        "name": "Special Occasions",
        "type": "expense",
        "icon": "party-popper",
        "color": "#06B6D4",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 46,
        "name": "Transport",
        "type": "expense",
        "icon": "bus",
        "color": "#14B8A6",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 47,
        "name": "Utilities",
        "type": "expense",
        "icon": "lightning-bolt",
        "color": "#64748B",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 48,
        "name": "Vacation",
        "type": "expense",
        "icon": "earth",
        "color": "#A3E635",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 49,
        "name": "Wallet Transfer",
        "type": "expense",
        "icon": "swap-horizontal",
        "color": "#6366F1",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
      },
      {
        "id": 50,
        "name": "Water / Purifier",
        "type": "expense",
        "icon": "cup-water",
        "color": "#64748B",
        "is_active": 1,
        "created_at": "2026-07-09 15:18:04"
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
    "budgets": [],
    "bills": [],
    "loans": [
      {
        "id": 3,
        "loan_name": "Gold Loan 3",
        "loan_type": "Other",
        "lender": "Pandiyan Bank",
        "loan_direction": "BORROWED",
        "principal_amount": 47000,
        "interest_rate": 0.75,
        "loan_start_date": "2018-11-11",
        "loan_end_date": null,
        "tenure_months": 12,
        "emi_amount": 0,
        "emi_day": null,
        "outstanding_amount": 47000,
        "principal_paid": 0,
        "interest_paid": 0,
        "total_paid": 0,
        "total_prepayment": 0,
        "remaining_months": 12,
        "status": "Active",
        "notes": "3rd Gold Loan",
        "created_at": "2026-07-14 08:25:17",
        "updated_at": "2026-07-14 08:25:17"
      },
      {
        "id": 2,
        "loan_name": "Gold Loan 2",
        "loan_type": "Other",
        "lender": "Bank of Baroda",
        "loan_direction": "BORROWED",
        "principal_amount": 100000,
        "interest_rate": 0.75,
        "loan_start_date": "2018-11-07",
        "loan_end_date": null,
        "tenure_months": 12,
        "emi_amount": 0,
        "emi_day": null,
        "outstanding_amount": 99424.45,
        "principal_paid": 575.55,
        "interest_paid": 249.95,
        "total_paid": 775,
        "total_prepayment": 0,
        "remaining_months": null,
        "status": "Active",
        "notes": "2nd Gold Loan ",
        "created_at": "2026-07-14 08:06:46",
        "updated_at": "2026-07-14 08:21:45"
      },
      {
        "id": 1,
        "loan_name": "Gold Loan 1",
        "loan_type": "Other",
        "lender": "Bank of Baroda",
        "loan_direction": "BORROWED",
        "principal_amount": 100000,
        "interest_rate": 0.75,
        "loan_start_date": "2018-01-22",
        "loan_end_date": null,
        "tenure_months": 12,
        "emi_amount": 0,
        "emi_day": 6,
        "outstanding_amount": 0,
        "principal_paid": 104157.62,
        "interest_paid": 426.41,
        "total_paid": 104572,
        "total_prepayment": 0,
        "remaining_months": null,
        "status": "Closed",
        "notes": "1st Gold Loan ",
        "created_at": "2026-07-13 16:08:41",
        "updated_at": "2026-07-13 16:14:19"
      }
    ],
    "loan_payments": [
      {
        "id": 1,
        "loan_id": 1,
        "payment_date": "2018-01-22T05:30:00.000Z",
        "payment_amount": 282,
        "principal_component": 219.5,
        "interest_component": 62.5,
        "remaining_balance": 99780.5,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2276,
        "remarks": "1st Loan: Processing Fee",
        "created_at": "2026-07-13 16:09:22"
      },
      {
        "id": 2,
        "loan_id": 1,
        "payment_date": "2018-01-23T04:30:00.000Z",
        "payment_amount": 590,
        "principal_component": 527.64,
        "interest_component": 62.36,
        "remaining_balance": 99252.86,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2277,
        "remarks": "1st Loan: Processing Fee",
        "created_at": "2026-07-13 16:10:10"
      },
      {
        "id": 3,
        "loan_id": 1,
        "payment_date": "2018-05-21T05:30:00.000Z",
        "payment_amount": 50,
        "principal_component": 0,
        "interest_component": 62.03,
        "remaining_balance": 99252.86,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 364,
        "remarks": "1st Loan: 1st Payment",
        "created_at": "2026-07-13 16:10:43"
      },
      {
        "id": 4,
        "loan_id": 1,
        "payment_date": "2018-05-21T05:30:00.000Z",
        "payment_amount": 9650,
        "principal_component": 9587.97,
        "interest_component": 62.03,
        "remaining_balance": 89664.89,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 365,
        "remarks": "1st Loan: 1st Payment",
        "created_at": "2026-07-13 16:12:31"
      },
      {
        "id": 5,
        "loan_id": 1,
        "payment_date": "2018-06-01T05:00:00.000Z",
        "payment_amount": 5000,
        "principal_component": 4943.96,
        "interest_component": 56.04,
        "remaining_balance": 84720.93,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 319,
        "remarks": "1st Loan: 2nd Payment",
        "created_at": "2026-07-13 16:13:39"
      },
      {
        "id": 6,
        "loan_id": 1,
        "payment_date": "2018-09-03T05:30:00.000Z",
        "payment_amount": 5000,
        "principal_component": 4947.05,
        "interest_component": 52.95,
        "remaining_balance": 79773.88,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2278,
        "remarks": "1st Loan: 3rd Payment",
        "created_at": "2026-07-13 16:13:57"
      },
      {
        "id": 7,
        "loan_id": 1,
        "payment_date": "2018-09-03T05:30:00.000Z",
        "payment_amount": 50000,
        "principal_component": 49950.14,
        "interest_component": 49.86,
        "remaining_balance": 29823.74,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2279,
        "remarks": "1st Loan: 4th Payment",
        "created_at": "2026-07-13 16:14:09"
      },
      {
        "id": 8,
        "loan_id": 1,
        "payment_date": "2018-11-03",
        "payment_amount": 34000,
        "principal_component": 33981.36,
        "interest_component": 18.64,
        "remaining_balance": 0,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2173,
        "remarks": "1st Loan: 5th Payment Closing",
        "created_at": "2026-07-13 16:14:19"
      },
      {
        "id": 9,
        "loan_id": 2,
        "payment_date": "2018-11-07",
        "payment_amount": 12,
        "principal_component": 0,
        "interest_component": 62.5,
        "remaining_balance": 100000,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2184,
        "remarks": "2nd Loan: Join Account Opening Xerox",
        "created_at": "2026-07-14 08:19:57"
      },
      {
        "id": 10,
        "loan_id": 2,
        "payment_date": "2018-11-07",
        "payment_amount": 100,
        "principal_component": 37.5,
        "interest_component": 62.5,
        "remaining_balance": 99962.5,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2186,
        "remarks": "2nd Loan: Join Account Opening Charge",
        "created_at": "2026-07-14 08:21:15"
      },
      {
        "id": 11,
        "loan_id": 2,
        "payment_date": "2018-11-07",
        "payment_amount": 67,
        "principal_component": 4.52,
        "interest_component": 62.48,
        "remaining_balance": 99957.98,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2187,
        "remarks": "2nd Loan: Join Account Opening Charge",
        "created_at": "2026-07-14 08:21:31"
      },
      {
        "id": 12,
        "loan_id": 2,
        "payment_date": "2018-11-07",
        "payment_amount": 596,
        "principal_component": 533.53,
        "interest_component": 62.47,
        "remaining_balance": 99424.45,
        "payment_type": "LINKED",
        "payment_source_id": 2,
        "payment_category_id": 23,
        "transaction_id": 2191,
        "remarks": "2nd Loan: Processing Fee",
        "created_at": "2026-07-14 08:21:45"
      }
    ]
  }
};

fs.writeFileSync(
  "2019_06.json",
  JSON.stringify(backup, null, 2),
  "utf8"
);

console.log("2019_06.json created successfully.");
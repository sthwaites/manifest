export type BaselineProduct = {
  id: string
  name: string
  category: string
  description: string
  specs: string
  price: number
}

export const baselineProducts: BaselineProduct[] = [
  {
    id: "prod_001",
    name: "Ceramic Pour-Over Coffee Set",
    category: "Kitchen",
    description: "Handthrown stoneware dripper and server. Porous matt glaze finish absorbs oils for a cleaner cup. Fits standard 02 filters.",
    specs: "450ml capacity · 18cm height · 320g · dishwasher safe",
    price: 42,
  },
  {
    id: "prod_002",
    name: "Merino Wool Throw Blanket",
    category: "Home",
    description: "Extra-fine 17.5 micron merino. Temperature-regulating, non-itchy. Woven in Portugal from certified mulesing-free wool.",
    specs: "130×170cm · 400g/m² · hand wash cold · air dry flat",
    price: 89,
  },
  {
    id: "prod_003",
    name: "Bamboo Desk Organiser",
    category: "Office",
    description: "Three-tier tray system with removable dividers. FSC-certified bamboo with natural beeswax finish. Fits A4 and US Letter.",
    specs: "24×18×10cm · 380g · assembly required (no tools)",
    price: 28,
  },
  {
    id: "prod_004",
    name: "Copper Cocktail Shaker",
    category: "Bar",
    description: "Seamless spun copper with tin lining. Weighted base prevents tipping. Leak-proof bayonet seal. Includes built-in strainer.",
    specs: "750ml · 28cm · solid copper exterior · tin interior · hand wash only",
    price: 35,
  },
  {
    id: "prod_005",
    name: "Linen Tote Bag",
    category: "Accessories",
    description: "Undyed Belgian linen. Reinforced cotton handles with leather rivets. Interior slip pocket. Gets better with washing.",
    specs: "40×38cm · 5cm gusset · natural undyed · 180g",
    price: 22,
  },
  {
    id: "prod_006",
    name: "Brass Candlestick Trio",
    category: "Home",
    description: "Hand-turned solid brass on a lathe. Three graduated heights sold as a set. Develops patina over time - polish or let it age.",
    specs: "8 / 12 / 16cm height · 1.2kg combined · fits standard 22mm taper candles",
    price: 54,
  },
]

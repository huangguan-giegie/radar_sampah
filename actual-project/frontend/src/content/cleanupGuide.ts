export const CLEANUP_GUIDE = {
  dropOffName: null as string | null,
  recyclingName: null as string | null,
  checkedDate: null as string | null,
  mapsUrl: null as string | null,
  equipment: [
    ["gloves", "Gloves"],
    ["bags", "Two bags"],
    ["cutters", "Cutters"],
    ["water", "Water"],
    ["shoes", "Closed shoes"],
    ["firstaid", "First aid"],
  ],
  reminders: [
    "Check the tide",
    "Hat & sunscreen",
    "Stay in pairs",
    "Don’t touch needles",
  ],
  sorting: [
    {
      image: "bottle",
      eyebrow: "Bag 1",
      title: "Recycling",
      text: "Clean cans, bottles, paper",
    },
    {
      image: "foam",
      eyebrow: "Bag 2",
      title: "General",
      text: "Everything else, incl. butts",
    },
    {
      image: "nettop",
      eyebrow: "Keep apart",
      title: "Glass & nets",
      text: "Wrap broken glass, bag nets",
    },
  ],
  wildlife: [
    "Keep away from nests and burrows",
    "Leave seaweed and driftwood in place",
    "Don’t touch stranded or tangled animals",
    "Cut loops and rings before binning",
    "Stay off seagrass and dunes",
  ],
};

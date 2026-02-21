export const structure = [

  {
    type: "header",
    title: "Battalion Command",
    children: [
      {
        type: "sub-header",
        title: "Battalion HQ",
        roles: [
          {
            role: "Battalion Commander",
            count: 1,
            slotId: "battalion-hq-commander",
          },
        ],
      },
    ],
  },

  {
    type: "header",
    title: "Company Command",
    children: [
      {
        type: "sub-header",
        title: "Company Command Staff",
        roles: [
          { role: "Company Commander", count: 1, slotId: "company-command-commander" },
          { role: "Company Executive Officer", count: 1, slotId: "company-command-xo" },
          { role: "Company NCOIC", count: 1, slotId: "company-command-ncoic" },
          { role: "Company Warrant Officer", count: 1, slotId: "company-command-wo" },
          { role: "Company RTO", count: 1, slotId: "company-command-rto" },
          { role: "Company Medic", count: 1, slotId: "company-command-medic" },
          { role: "Company Pilot", count: 1, slotId: "company-command-pilot" },
        ],
      },
    ],
  },

  {
    type: "header",
    title: "Tomahawk 1",
    children: [
      {
        type: "sub-header",
        title: "Platoon Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "tomahawk1-platoon-commander" },
          { role: "Platoon Sergeant Major", count: 1, slotId: "tomahawk1-platoon-sgm" },
          { role: "Platoon Warrant Officer", count: 1, slotId: "tomahawk1-platoon-wo" },
          { role: "Platoon RTO", count: 1, slotId: "tomahawk1-platoon-rto" },
          { role: "Platoon Medic", count: 1, slotId: "tomahawk1-platoon-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-1A",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "tomahawk1-1-1a-squadlead" },
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-1a-teamlead" },
          { role: "RTO", count: 1, slotId: "tomahawk1-1-1a-rto" },
          { role: "Trooper", count: 1, slotId: "tomahawk1-1-1a-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-1a-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-1B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-1b-teamlead" },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-1b-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-1b-medic" },
        ],
      },
    ],
  },

];

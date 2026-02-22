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
	  {
        type: "sub-header",
        title: "1-2A",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "tomahawk1-1-2a-squadlead" },
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-2a-teamlead" },
          { role: "RTO", count: 1, slotId: "tomahawk1-1-2a-rto" },
          { role: "Trooper", count: 1, slotId: "tomahawk1-1-2a-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-2a-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-2B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-2b-teamlead" },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-2b-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-2b-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-3A",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "tomahawk1-1-3a-squadlead" },
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-3a-teamlead" },
          { role: "RTO", count: 1, slotId: "tomahawk1-1-3a-rto" },
          { role: "Trooper", count: 1, slotId: "tomahawk1-1-3a-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-3a-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-3B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-3b-teamlead" },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-3b-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-3b-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "Scimitar",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-1b-teamlead" },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-1b-trooper" },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-1b-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "Scimitar 1-1",
        roles: [
          { role: "Team Lead", count: 1, slotId: "scimitar1-1-1-teamlead" },
          { role: "Trooper", count: 2, slotId: "scimitar1-1-1-trooper" },
          { role: "Medic", count: 1, slotId: "scimitar1-1-1-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "Scimitar 1-2",
        roles: [
          { role: "Team Lead", count: 1, slotId: "scimitar1-1-2-teamlead" },
          { role: "Trooper", count: 2, slotId: "scimitar1-1-2-trooper" },
          { role: "Medic", count: 1, slotId: "scimitar1-1-2-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "Scimitar 1-3",
        roles: [
          { role: "Team Lead", count: 1, slotId: "scimitar1-3-teamlead" },
          { role: "Trooper", count: 2, slotId: "scimitar1-3-trooper" },
          { role: "Medic", count: 1, slotId: "scimitar1-3-medic" },
        ],
      },
    ],
  },
  {
    type: "header",
    title: "Broadsword 3",
    children: [
      {
        type: "sub-header",
        title: "Platoon Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "Broadsword3-platoon-commander" },
          { role: "Platoon Sergeant Major", count: 1, slotId: "Broadsword3-platoon-sgm" },
          { role: "Platoon Warrant Officer", count: 1, slotId: "Broadsword3-platoon-wo" },
          { role: "Platoon RTO", count: 1, slotId: "Broadsword3-platoon-rto" },
          { role: "Platoon Medic", count: 1, slotId: "Broadsword3-platoon-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "3-1",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Broadsword3-1-1a-squadlead" },
          { role: "ASL", count: 1, slotId: "Broadsword3-1-1a-ASL" },
		  { role: "RTO", count: 1, slotId: "Broadsword3-1-1a-RTO" },
		  { role: "Trooper", count: 5, slotId: "Broadsword3-1-1a-Trooper" },
		  { role: "Medic", count: 2, slotId: "Broadsword3-1-1a-Medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "3-2",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Broadsword3-2-1a-squadlead" },
          { role: "ASL", count: 1, slotId: "Broadsword3-2-1a-ASL" },
		  { role: "RTO", count: 1, slotId: "Broadsword3-2-1a-RTO" },
		  { role: "Trooper", count: 5, slotId: "Broadsword3-2-1a-Trooper" },
		  { role: "Medic", count: 2, slotId: "Broadsword3-2-1a-Medic" },
        ],
      },
		  {
        type: "sub-header",
        title: "3-3",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Broadsword3-3-1a-squadlead" },
          { role: "ASL", count: 1, slotId: "Broadsword3-3-1a-ASL" },
		  { role: "RTO", count: 1, slotId: "Broadsword3-3-1a-RTO" },
		  { role: "Trooper", count: 5, slotId: "Broadsword3-3-1a-Trooper" },
		  { role: "Medic", count: 2, slotId: "Broadsword3-3-1a-Medic" },
        ],
      },
    ],
  },
  {
    type: "header",
    title: "Dagger",
    children: [
      {
        type: "sub-header",
        title: "Dagger Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "Dagger-platoon-commander" },
          { role: "Platoon Sergeant Major", count: 1, slotId: "Dagger-platoon-sgm" },
          { role: "Platoon Warrant Officer", count: 1, slotId: "Dagger-platoon-wo" },
          { role: "Platoon RTO", count: 1, slotId: "Dagger-platoon-rto" },
          { role: "Platoon Medic", count: 1, slotId: "Dagger-platoon-medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-1",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Dagger1-1-1a-squadlead" },
          { role: "ASL", count: 1, slotId: "Dagger1-1-1a-ASL" },
		  { role: "RTO", count: 1, slotId: "Dagger1-1-1a-RTO" },
		  { role: "Trooper", count: 3, slotId: "Dagger1-1-1a-Trooper" },
		  { role: "Medic", count: 2, slotId: "Dagger1-1-1a-Medic" },
        ],
      },
	  {
        type: "sub-header",
        title: "1-2",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Dagger1-2-1a-squadlead" },
          { role: "ASL", count: 1, slotId: "Dagger1-2-1a-ASL" },
		  { role: "RTO", count: 1, slotId: "Dagger1-2-1a-RTO" },
		  { role: "Trooper", count: 3, slotId: "Dagger1-2-1a-Trooper" },
		  { role: "Medic", count: 2, slotId: "Dagger1-2-1a-Medic" },
        ],
      },
		  {
        type: "sub-header",
        title: "1-3",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Dagger1-3-1a-squadlead" },
          { role: "ASL", count: 1, slotId: "Dagger1-3-1a-ASL" },
		  { role: "RTO", count: 1, slotId: "Dagger1-3-1a-RTO" },
		  { role: "Trooper", count: 3, slotId: "Dagger1-3-1a-Trooper" },
		  { role: "Medic", count: 2, slotId: "Dagger1-3-1a-Medic" },
        ],
      },
    ],
  },
  {
    type: "header",
    title: "Hammer",
    children: [
      {
        type: "sub-header",
        title: "Hammer 1",
        roles: [
          { role: "Hammer 1A", count: 1, slotId: "Hammer-1A" },
          { role: "Hammer 1B", count: 1, slotId: "Hammer-1B" },
          { role: "Hammer 1C", count: 1, slotId: "Hammer-1C" },
          { role: "Hammer 1D", count: 1, slotId: "Hammer-1D" },
        ],
      },
	  {
        type: "sub-header",
        title: "Hammer 2",
        roles: [
          { role: "Hammer 2A", count: 1, slotId: "Hammer-2A" },
          { role: "Hammer 2B", count: 1, slotId: "Hammer-2B" },
          { role: "Hammer 2C", count: 1, slotId: "Hammer-2C" },
          { role: "Hammer 2D", count: 1, slotId: "Hammer-2D" },
        ],
      },
	  {
        type: "sub-header",
        title: "Hammer 3",
        roles: [
          { role: "Hammer 3A", count: 1, slotId: "Hammer-3A" },
          { role: "Hammer 3B", count: 1, slotId: "Hammer-3B" },
          { role: "Hammer 3C", count: 1, slotId: "Hammer-3C" },
          { role: "Hammer 3D", count: 1, slotId: "Hammer-3D" },
        ],
      },
		  {
        type: "sub-header",
        title: "Hammer 4",
        roles: [
          { role: "Hammer 4A", count: 1, slotId: "Hammer-4A" },
          { role: "Hammer 4B", count: 1, slotId: "Hammer-4B" },
          { role: "Hammer 4C", count: 1, slotId: "Hammer-4C" },
          { role: "Hammer 4D", count: 1, slotId: "Hammer-4D" },
        ],
      },
    ],
  },
  
];

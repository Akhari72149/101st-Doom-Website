export const structure = [

  /* ================= BATTALION ================= */

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
            discordRoleIds: [],
          },
        ],
      },
    ],
  },

  /* ================= COMPANY ================= */

  {
    type: "header",
    title: "Company Command",
    children: [
      {
        type: "sub-header",
        title: "Company Command Staff",
        roles: [
          { role: "Company Commander", count: 1, slotId: "company-command-commander", discordRoleIds: [] },
          { role: "Company Executive Officer", count: 1, slotId: "company-command-xo", discordRoleIds: [] },
          { role: "Company NCOIC", count: 1, slotId: "company-command-ncoic", discordRoleIds: [] },
          { role: "Company Warrant Officer", count: 1, slotId: "company-command-wo", discordRoleIds: [] },
          { role: "Company RTO", count: 1, slotId: "company-command-rto", discordRoleIds: [] },
          { role: "Company Medic", count: 1, slotId: "company-command-medic", discordRoleIds: [] },
          { role: "Company Pilot", count: 1, slotId: "company-command-pilot", discordRoleIds: [] },
        ],
      },
    ],
  },

  /* ================= TOMAHAWK 1 ================= */

  {
    type: "header",
    title: "Tomahawk 1",
    children: [

      {
        type: "sub-header",
        title: "Platoon Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "tomahawk1-platoon-commander", discordRoleIds: ["757765398392209593","840037756642263081"] },
          { role: "Platoon Sergeant Major", count: 1, slotId: "tomahawk1-platoon-sgm", discordRoleIds: ["757765398392209593","840037756642263081"] },
          { role: "Platoon Warrant Officer", count: 1, slotId: "tomahawk1-platoon-wo", discordRoleIds: ["840037756642263081","757765856494223451","757766371361816626"] },
          { role: "Platoon RTO", count: 1, slotId: "tomahawk1-platoon-rto", discordRoleIds: ["840037756642263081", "757766371361816626"] },
          { role: "Platoon Medic", count: 1, slotId: "tomahawk1-platoon-medic", discordRoleIds: ["840037756642263081", "757766371361816626"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-1A",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "tomahawk1-1-1a-squadlead", discordRoleIds: ["757766977350664232", "840037756642263081", "757765856494223451"] },
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-1a-teamlead", discordRoleIds: ["757766977350664232", "840037756642263081", "757765856494223451"] },
          { role: "RTO", count: 1, slotId: "tomahawk1-1-1a-rto", discordRoleIds: ["757766977350664232", "840037756642263081"] },
          { role: "Trooper", count: 1, slotId: "tomahawk1-1-1a-trooper", discordRoleIds: ["757766977350664232", "840037756642263081"] },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-1a-medic", discordRoleIds: ["757766977350664232", "840037756642263081"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-1B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-1b-teamlead", discordRoleIds: ["757766977350664232", "840037756642263081", "757765856494223451"] },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-1b-trooper", discordRoleIds: ["757766977350664232", "840037756642263081"] },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-1b-medic", discordRoleIds: ["757766977350664232", "840037756642263081"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-2A",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "tomahawk1-1-2a-squadlead", discordRoleIds: ["757767541807644712", "840037756642263081", "757765856494223451"] },
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-2a-teamlead", discordRoleIds: ["757767541807644712", "840037756642263081", "757765856494223451"] },
          { role: "RTO", count: 1, slotId: "tomahawk1-1-2a-rto", discordRoleIds: ["757767541807644712", "840037756642263081"] },
          { role: "Trooper", count: 1, slotId: "tomahawk1-1-2a-trooper", discordRoleIds: ["757767541807644712", "840037756642263081"] },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-2a-medic", discordRoleIds: ["757767541807644712", "840037756642263081"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-2B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-2b-teamlead", discordRoleIds: ["757767541807644712", "840037756642263081", "757765856494223451"] },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-2b-trooper", discordRoleIds: ["757767541807644712", "840037756642263081"] },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-2b-medic", discordRoleIds: ["757767541807644712", "840037756642263081"] },
        ],
      },
	{
        type: "sub-header",
        title: "1-3A",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "tomahawk1-1-2a-squadlead", discordRoleIds: ["757767664474259606", "840037756642263081", "757765856494223451"] },
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-2a-teamlead", discordRoleIds: ["757767664474259606", "840037756642263081", "757765856494223451"] },
          { role: "RTO", count: 1, slotId: "tomahawk1-1-2a-rto", discordRoleIds: ["757767664474259606", "840037756642263081"] },
          { role: "Trooper", count: 1, slotId: "tomahawk1-1-2a-trooper", discordRoleIds: ["757767664474259606", "840037756642263081"] },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-2a-medic", discordRoleIds: ["757767664474259606", "840037756642263081"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-3B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "tomahawk1-1-2b-teamlead", discordRoleIds: ["757767664474259606", "840037756642263081", "757765856494223451"] },
          { role: "Trooper", count: 2, slotId: "tomahawk1-1-2b-trooper", discordRoleIds: ["757767664474259606", "840037756642263081"] },
          { role: "Medic", count: 1, slotId: "tomahawk1-1-2b-medic", discordRoleIds: ["757767664474259606", "840037756642263081"] },
        ],
      },
	  

      {
        type: "sub-header",
        title: "Scimitar HQ",
        roles: [
          { role: "Troop Leader", count: 1, slotId: "tomahawk1-scimitar-teamlead", discordRoleIds: ["1259512490300276756", "840037756642263081"] },
          { role: "Trooper", count: 1, slotId: "tomahawk1-scimitar-trooper", discordRoleIds: ["1259512490300276756", "840037756642263081"] },
          { role: "Trooper", count: 1, slotId: "tomahawk1-scimitar-medic", discordRoleIds: ["1259512490300276756", "840037756642263081"] },
        ],
      },

      {
        type: "sub-header",
        title: "Scimitar 1-1",
        roles: [
          { role: "Team Lead", count: 1, slotId: "scimitar1-1-1-teamlead", discordRoleIds: ["1259512490300276756", "840037756642263081","757766977350664232"] },
          { role: "Trooper", count: 2, slotId: "scimitar1-1-1-trooper", discordRoleIds: ["1259512490300276756", "840037756642263081","757766977350664232"] },
        ],
      },

      {
        type: "sub-header",
        title: "Scimitar 1-2",
        roles: [
          { role: "Team Lead", count: 1, slotId: "scimitar1-1-2-teamlead", discordRoleIds: ["1259512490300276756", "840037756642263081","757767541807644712"] },
          { role: "Trooper", count: 2, slotId: "scimitar1-1-2-trooper", discordRoleIds: ["1259512490300276756", "840037756642263081","757767541807644712"] },
        ],
      },

      {
        type: "sub-header",
        title: "Scimitar 1-3",
        roles: [
          { role: "Team Lead", count: 1, slotId: "scimitar1-3-teamlead", discordRoleIds: ["1259512490300276756", "840037756642263081","757767664474259606"] },
          { role: "Trooper", count: 2, slotId: "scimitar1-3-trooper", discordRoleIds: ["1259512490300276756", "840037756642263081","757767664474259606"] },
        ],
      },

    ],
  },

  /* ================= CLAYMORE 2 ================= */

  {
    type: "header",
    title: "Claymore 2",
    children: [
      {
        type: "sub-header",
        title: "Platoon Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "Claymore2-platoon-commander", discordRoleIds: ["803682655601688576", "840037530518945823"] },
          { role: "Platoon Sergeant Major", count: 1, slotId: "Claymore2-platoon-sgm", discordRoleIds: ["803682655601688576", "840037530518945823"] },
          { role: "Platoon Warrant Officer", count: 1, slotId: "Claymore2-platoon-wo", discordRoleIds: ["840037530518945823", "803683474300076042"] },
          { role: "Platoon RTO", count: 1, slotId: "Claymore2-platoon-rto", discordRoleIds: ["840037530518945823", "803683474300076042"] },
          { role: "Platoon Medic", count: 1, slotId: "Claymore2-platoon-medic", discordRoleIds: ["840037530518945823", "803683474300076042"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-1",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Claymore2-1-1-squadlead", discordRoleIds: ["803683902597758992", "840037530518945823", "803683130643972177"] },
          { role: "RTO", count: 1, slotId: "Claymore2-1-1-teamlead", discordRoleIds: ["803683902597758992", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-1A",
        roles: [
          { role: "Team Lead", count: 1, slotId: "Claymore2-1-1a-teamlead", discordRoleIds: ["803683902597758992", "840037530518945823", "803683130643972177"] },
          { role: "Trooper", count: 3, slotId: "Claymore2-1-1a-trooper", discordRoleIds: ["803683902597758992", "840037530518945823"] },
          { role: "Medic", count: 2, slotId: "Claymore2-1-1a-medic", discordRoleIds: ["803683902597758992", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-1B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "Claymore2-1-1b-squadlead", discordRoleIds: ["803683902597758992", "840037530518945823", "803683130643972177"] },
          { role: "Trooper", count: 3, slotId: "Claymore2-1-1b-teamlead", discordRoleIds: ["803683902597758992", "840037530518945823"] },
          { role: "Medic", count: 1, slotId: "Claymore2-1-1b-rto", discordRoleIds: ["803683902597758992", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-2",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Claymore2-2-1-squadlead", discordRoleIds: ["803684088757747823", "840037530518945823", "803683130643972177"] },
          { role: "RTO", count: 1, slotId: "Claymore2-2-1-teamlead", discordRoleIds: ["803684088757747823", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-2A",
        roles: [
          { role: "Team Lead", count: 1, slotId: "Claymore2-2-1a-teamlead", discordRoleIds: ["803684088757747823", "840037530518945823", "803683130643972177"] },
          { role: "Trooper", count: 3, slotId: "Claymore2-2-1a-trooper", discordRoleIds: ["803684088757747823", "840037530518945823"] },
          { role: "Medic", count: 2, slotId: "Claymore2-2-1a-medic", discordRoleIds: ["803684088757747823", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-2B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "Claymore2-2-1b-squadlead", discordRoleIds: ["803684088757747823", "840037530518945823", "803683130643972177"] },
          { role: "Trooper", count: 3, slotId: "Claymore2-2-1b-teamlead", discordRoleIds: ["803684088757747823", "840037530518945823"] },
          { role: "Medic", count: 1, slotId: "Claymore2-2-1b-rto", discordRoleIds: ["803684088757747823", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-3",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Claymore2-3-1-squadlead", discordRoleIds: ["803683976971681872", "840037530518945823", "803683130643972177"] },
          { role: "RTO", count: 1, slotId: "Claymore2-3-1-teamlead", discordRoleIds: ["803683976971681872", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-3A",
        roles: [
          { role: "Team Lead", count: 1, slotId: "Claymore2-3-1a-teamlead", discordRoleIds: ["803683976971681872", "840037530518945823", "803683130643972177"] },
          { role: "Trooper", count: 3, slotId: "Claymore2-3-1a-trooper", discordRoleIds: ["803683976971681872", "840037530518945823"] },
          { role: "Medic", count: 2, slotId: "Claymore2-3-1a-medic", discordRoleIds: ["803683976971681872", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "2-3B",
        roles: [
          { role: "Team Lead", count: 1, slotId: "Claymore2-3-1b-squadlead", discordRoleIds: ["803683976971681872", "840037530518945823", "803683130643972177"] },
          { role: "Trooper", count: 3, slotId: "Claymore2-3-1b-teamlead", discordRoleIds: ["803683976971681872", "840037530518945823"] },
          { role: "Medic", count: 1, slotId: "Claymore2-3-1b-rto", discordRoleIds: ["803683976971681872", "840037530518945823"] },
        ],
      },
    ],
  },

  /* ================= BROADSWORD 3 ================= */

  {
    type: "header",
    title: "Broadsword 3",
    children: [

      {
        type: "sub-header",
        title: "Platoon Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "Broadsword3-platoon-commander", discordRoleIds: ["679477605975719949", "848977413009834034"] },
          { role: "Platoon Sergeant Major", count: 1, slotId: "Broadsword3-platoon-sgm", discordRoleIds: ["679477605975719949", "848977413009834034"] },
          { role: "Platoon Warrant Officer", count: 1, slotId: "Broadsword3-platoon-wo", discordRoleIds: ["848977413009834034", "727738796027936798"] },
          { role: "Platoon RTO", count: 1, slotId: "Broadsword3-platoon-rto", discordRoleIds: ["848977413009834034", "727738796027936798"] },
          { role: "Platoon Medic", count: 1, slotId: "Broadsword3-platoon-medic", discordRoleIds: ["848977413009834034", "727738796027936798"] },
        ],
      },

      {
        type: "sub-header",
        title: "3-1",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Broadsword3-1-1a-squadlead", discordRoleIds: ["692226734283685928", "848977413009834034", "692226671989751841"] },
          { role: "ASL", count: 1, slotId: "Broadsword3-1-1a-ASL", discordRoleIds: ["692226734283685928", "848977413009834034", "692226671989751841"] },
          { role: "RTO", count: 1, slotId: "Broadsword3-1-1a-RTO", discordRoleIds: ["692226734283685928", "848977413009834034"] },
          { role: "Trooper", count: 5, slotId: "Broadsword3-1-1a-Trooper", discordRoleIds: ["692226734283685928", "848977413009834034"] },
          { role: "Medic", count: 2, slotId: "Broadsword3-1-1a-Medic", discordRoleIds: ["692226734283685928", "848977413009834034"] },
        ],
      },

      {
        type: "sub-header",
        title: "3-2",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Broadsword3-2-1a-squadlead", discordRoleIds: ["692226750419173397", "848977413009834034", "692226671989751841"] },
          { role: "ASL", count: 1, slotId: "Broadsword3-2-1a-ASL", discordRoleIds: ["692226750419173397", "848977413009834034", "692226671989751841"] },
          { role: "RTO", count: 1, slotId: "Broadsword3-2-1a-RTO", discordRoleIds: ["692226750419173397", "848977413009834034"] },
          { role: "Trooper", count: 5, slotId: "Broadsword3-2-1a-Trooper", discordRoleIds: ["692226750419173397", "848977413009834034"] },
          { role: "Medic", count: 2, slotId: "Broadsword3-2-1a-Medic", discordRoleIds: ["692226750419173397", "848977413009834034"] },
        ],
      },

      {
        type: "sub-header",
        title: "3-3",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Broadsword3-3-1a-squadlead", discordRoleIds: ["692226922838622298", "848977413009834034", "692226671989751841"] },
          { role: "ASL", count: 1, slotId: "Broadsword3-3-1a-ASL", discordRoleIds: ["692226922838622298", "848977413009834034", "692226671989751841"] },
          { role: "RTO", count: 1, slotId: "Broadsword3-3-1a-RTO", discordRoleIds: ["692226922838622298", "848977413009834034"] },
          { role: "Trooper", count: 5, slotId: "Broadsword3-3-1a-Trooper", discordRoleIds: ["692226922838622298", "848977413009834034"] },
          { role: "Medic", count: 2, slotId: "Broadsword3-3-1a-Medic", discordRoleIds: ["692226922838622298", "848977413009834034"] },
        ],
      },

      {
        type: "sub-header",
        title: "Halberd",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Halberd3-3-1a-squadlead", discordRoleIds: ["1026840188862869525", "848977413009834034", "692226671989751841"] },
          { role: "ASL", count: 1, slotId: "Halberd3-3-1a-ASL", discordRoleIds: ["1026840188862869525", "848977413009834034", "692226671989751841"] },
          { role: "RTO", count: 1, slotId: "Halberd3-3-1a-RTO", discordRoleIds: ["1026840188862869525", "848977413009834034"] },
          { role: "Trooper", count: 5, slotId: "Halberd3-3-1a-Trooper", discordRoleIds: ["1026840188862869525", "848977413009834034"] },
          { role: "Medic", count: 2, slotId: "Halberd3-3-1a-Medic", discordRoleIds: ["1026840188862869525", "848977413009834034"] },
        ],
      },

    ],
  },

  /* ================= DAGGER ================= */

  {
    type: "header",
    title: "Dagger",
    children: [

      {
        type: "sub-header",
        title: "Dagger Command",
        roles: [
          { role: "Platoon Commander", count: 1, slotId: "Dagger-platoon-commander", discordRoleIds: ["570431363698655327", "512875704950587402", "796660956604268554"] },
          { role: "Platoon Sergeant Major", count: 1, slotId: "Dagger-platoon-sgm", discordRoleIds: ["570431363698655327", "512875704950587402", "796660956604268554"] },
          { role: "Platoon Warrant Officer", count: 1, slotId: "Dagger-platoon-wo", discordRoleIds: ["755622907224260618", "512875704950587402", "796660956604268554"] },
          { role: "Platoon RTO", count: 1, slotId: "Dagger-platoon-rto", discordRoleIds: ["755622907224260618", "512875704950587402", "796660956604268554"] },
          { role: "Platoon Medic", count: 1, slotId: "Dagger-platoon-medic", discordRoleIds: ["755622907224260618", "512875704950587402", "796660956604268554"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-1",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Dagger1-1-1a-squadlead", discordRoleIds: ["512875704950587402", "747540448989544528" ,"796660956604268554"] },
          { role: "ASL", count: 1, slotId: "Dagger1-1-1a-ASL", discordRoleIds: ["512875704950587402", "747540448989544528" ,"796660956604268554"] },
          { role: "RTO", count: 1, slotId: "Dagger1-1-1a-RTO", discordRoleIds: ["512875704950587402", "747540448989544528"] },
          { role: "Trooper", count: 3, slotId: "Dagger1-1-1a-Trooper", discordRoleIds: ["512875704950587402", "747540448989544528"] },
          { role: "Medic", count: 2, slotId: "Dagger1-1-1a-Medic", discordRoleIds: ["512875704950587402", "747540448989544528"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-2",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Dagger1-2-1a-squadlead", discordRoleIds: ["512875704950587402", "747540204776063006" ,"796660956604268554"] },
          { role: "ASL", count: 1, slotId: "Dagger1-2-1a-ASL", discordRoleIds: ["512875704950587402", "747540204776063006" ,"796660956604268554"] },
          { role: "RTO", count: 1, slotId: "Dagger1-2-1a-RTO", discordRoleIds: ["512875704950587402", "747540204776063006"] },
          { role: "Trooper", count: 3, slotId: "Dagger1-2-1a-Trooper", discordRoleIds: ["512875704950587402", "747540204776063006"] },
          { role: "Medic", count: 2, slotId: "Dagger1-2-1a-Medic", discordRoleIds: ["512875704950587402", "747540204776063006"] },
        ],
      },

      {
        type: "sub-header",
        title: "1-3",
        roles: [
          { role: "Squad Lead", count: 1, slotId: "Dagger1-3-1a-squadlead", discordRoleIds: ["512875704950587402", "823737294191067147" ,"796660956604268554"] },
          { role: "ASL", count: 1, slotId: "Dagger1-3-1a-ASL", discordRoleIds: ["512875704950587402", "823737294191067147" ,"796660956604268554"] },
          { role: "RTO", count: 1, slotId: "Dagger1-3-1a-RTO", discordRoleIds: ["512875704950587402", "823737294191067147"] },
          { role: "Trooper", count: 3, slotId: "Dagger1-3-1a-Trooper", discordRoleIds: ["512875704950587402", "823737294191067147"] },
          { role: "Medic", count: 2, slotId: "Dagger1-3-1a-Medic", discordRoleIds: ["512875704950587402", "823737294191067147"] },
        ],
      },

    ],
  },

  /* ================= HAMMER ================= */

  {
    type: "header",
    title: "Hammer",
    children: [

      {
        type: "sub-header",
        title: "Hammer 1",
        roles: [
          { role: "Hammer 1A", count: 1, slotId: "Hammer-1A", discordRoleIds: ["610341820643409931", "745815374662205541", "840037756642263081", "757766371361816626", "730281550221934652"] },
          { role: "Hammer 1B", count: 1, slotId: "Hammer-1B", discordRoleIds: ["610341820643409931", "745815374662205541", "840037756642263081"] },
          { role: "Hammer 1C", count: 1, slotId: "Hammer-1C", discordRoleIds: ["610341820643409931", "745815374662205541", "840037756642263081"] },
          { role: "Hammer 1D", count: 1, slotId: "Hammer-1D", discordRoleIds: ["610341820643409931", "745815374662205541", "840037756642263081"] },
        ],
      },

      {
        type: "sub-header",
        title: "Hammer 2",
        roles: [
          { role: "Hammer 2A", count: 1, slotId: "Hammer-2A", discordRoleIds: ["610341820643409931", "745815564286558309", "840037530518945823", "803683474300076042", "730281550221934652"] },
          { role: "Hammer 2B", count: 1, slotId: "Hammer-2B", discordRoleIds: ["610341820643409931", "745815564286558309", "840037530518945823"] },
          { role: "Hammer 2C", count: 1, slotId: "Hammer-2C", discordRoleIds: ["610341820643409931", "745815564286558309", "840037530518945823"] },
          { role: "Hammer 2D", count: 1, slotId: "Hammer-2D", discordRoleIds: ["610341820643409931", "745815564286558309", "840037530518945823"] },
        ],
      },

      {
        type: "sub-header",
        title: "Hammer 3",
        roles: [
          { role: "Hammer 3A", count: 1, slotId: "Hammer-3A", discordRoleIds: ["610341820643409931", "676305174280667136", "848977413009834034", "727738796027936798", "730281550221934652"] },
          { role: "Hammer 3B", count: 1, slotId: "Hammer-3B", discordRoleIds: ["610341820643409931", "676305174280667136", "848977413009834034"] },
          { role: "Hammer 3C", count: 1, slotId: "Hammer-3C", discordRoleIds: ["610341820643409931", "676305174280667136", "848977413009834034"] },
          { role: "Hammer 3D", count: 1, slotId: "Hammer-3D", discordRoleIds: ["610341820643409931", "676305174280667136", "848977413009834034"] },
        ],
      },

      {
        type: "sub-header",
        title: "Hammer 4",
        roles: [
          { role: "Hammer 4A", count: 1, slotId: "Hammer-4A", discordRoleIds: ["610341820643409931", "834826797807697980", "755622907224260618", "512875704950587402", "730281550221934652"] },
          { role: "Hammer 4B", count: 1, slotId: "Hammer-4B", discordRoleIds: ["610341820643409931", "834826797807697980", "512875704950587402"] },
          { role: "Hammer 4C", count: 1, slotId: "Hammer-4C", discordRoleIds: ["610341820643409931", "834826797807697980", "512875704950587402"] },
          { role: "Hammer 4D", count: 1, slotId: "Hammer-4D", discordRoleIds: ["610341820643409931", "834826797807697980", "512875704950587402"] },
        ],
      },

    ],
  },

];
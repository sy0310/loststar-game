window.SurvivorBalance = {
  "version": "0.6.3",
  "runSeconds": 600,
  "eliteAt": 70,
  "bossAt": 130,
  "firstLevelXP": 72,
  "activeSlots": 6,
  "passiveSlots": 6,
  "activeMaxLevel": 5,
  "passiveMaxLevel": 5,
  "hullUpgradeBase": 70,
  "gunUpgradeBase": 90,
  "permanentMaxLevel": 3,
  "maxEnemies": 40,
  "maxFriendlyShots": 72,
  "maxEnemyShots": 56,
  "maxPickups": 140,
  "maxParticles": 160,
  "maxDamageNumbers": 28,
  "maxArcs": 24,
  "maxRings": 24,
  "maxBursts": 28,
  "maxChainTargets": 4,
  "checkpointSeconds": 2,
  "profileKey": "loststar.survivor.prototype.v01",
  "database": "loststar.survivor.demo.v06",
  "levelXP": {
    "base": 56,
    "linear": 14,
    "power": 1.4,
    "powerScale": 2.5
  },
  "milestones": [
    {
      "at": 70,
      "type": "elite",
      "tier": 1
    },
    {
      "at": 130,
      "type": "boss",
      "tier": 1
    },
    {
      "at": 220,
      "type": "elite",
      "tier": 2
    },
    {
      "at": 310,
      "type": "boss",
      "tier": 2
    },
    {
      "at": 400,
      "type": "elite",
      "tier": 3
    },
    {
      "at": 490,
      "type": "elite",
      "tier": 3
    },
    {
      "at": 550,
      "type": "boss",
      "tier": 3
    }
  ],
  "enemyHealthTimeScale": 200,
  "combat": {
    "healthTimeScale": 190,
    "fireSpeedScale": 1.08,
    "spawnIntervalScale": 0.96,
    "maxHazards": 12,
    "waves": [
      {
        "from": 0,
        "pool": [
          "skimmer",
          "skimmer",
          "wisp",
          "ranger"
        ],
        "hint": "四面来敌 · 自由移动"
      },
      {
        "from": 25,
        "pool": [
          "skimmer",
          "skimmer",
          "wisp",
          "ranger",
          "lancer",
          "tank"
        ],
        "hint": "突刺接近 · 留意锁线"
      },
      {
        "from": 65,
        "pool": [
          "skimmer",
          "wisp",
          "ranger",
          "lancer",
          "tank",
          "minelayer"
        ],
        "hint": "封锁空域 · 留意雷区"
      },
      {
        "from": 105,
        "pool": [
          "skimmer",
          "wisp",
          "ranger",
          "lancer",
          "tank",
          "minelayer",
          "sentinel"
        ],
        "hint": "交叉火力 · 留意束流"
      }
    ],
    "damage": {
      "shot": 6,
      "beam": 8,
      "shock": 8,
      "mine": 10
    },
    "attackUnlock": {
      "wisp": 30,
      "tank": 70
    },
    "populationCaps": {
      "lancer": 3,
      "sentinel": 2,
      "minelayer": 2,
      "ranger": 3,
      "wisp": 4,
      "tank": 3
    }
  },
  "legacyLevelXP": {
    "base": 80,
    "linear": 38,
    "power": 1.4,
    "powerScale": 8
  },
  "progression": {
    "version": 2,
    "bossAdvancedChance": 0.75,
    "activePower": [
      0,
      1,
      1.7,
      2.4,
      2.7,
      3
    ],
    "passivePower": [
      0,
      0.8,
      1.2,
      1.5,
      1.8,
      2
    ],
    "milestones": [
      {
        "at": 70,
        "type": "elite",
        "tier": 1
      },
      {
        "at": 130,
        "type": "boss",
        "tier": 1
      },
      {
        "at": 160,
        "type": "elite",
        "tier": 1
      },
      {
        "at": 250,
        "type": "elite",
        "tier": 2
      },
      {
        "at": 310,
        "type": "boss",
        "tier": 2
      },
      {
        "at": 340,
        "type": "elite",
        "tier": 2
      },
      {
        "at": 430,
        "type": "elite",
        "tier": 3
      },
      {
        "at": 520,
        "type": "elite",
        "tier": 3
      },
      {
        "at": 550,
        "type": "boss",
        "tier": 3
      }
    ]
  }
};

use serde::{Deserialize, Serialize};

pub const TILE: f32 = 50.0;
pub const COLS: usize = 16;
pub const ROWS: usize = 12;
pub const W: f32 = 800.0;
pub const H: f32 = 600.0;
pub const AW: f32 = 800.0;
pub const AH: f32 = 400.0;
pub const AY: f32 = 100.0;

pub const BASE_SPEED: f32 = 45.0;
pub const ENGAGE_R: f32 = 25.0;
pub const FLAG_R: f32 = 20.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TerrainType {
    Plains,
    Forest,
    Mountain,
    Fort,
}

impl TerrainType {
    pub fn speed_mult(self) -> f32 {
        match self {
            TerrainType::Plains => 1.0,
            TerrainType::Forest => 0.7,
            TerrainType::Mountain => 0.4,
            TerrainType::Fort => 0.5,
        }
    }

    pub fn drain_mult(self) -> f32 {
        match self {
            TerrainType::Plains => 1.0,
            TerrainType::Forest => 1.2,
            TerrainType::Mountain => 2.0,
            TerrainType::Fort => 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Faction {
    Player,
    Ai,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UnitType {
    Knights,
    Archers,
    Barbarians,
}

impl UnitType {
    pub const ALL: [UnitType; 3] = [UnitType::Knights, UnitType::Archers, UnitType::Barbarians];

    pub fn hp(self) -> f32 {
        match self {
            UnitType::Knights => 10.0,
            UnitType::Archers => 5.0,
            UnitType::Barbarians => 6.0,
        }
    }

    pub fn speed(self) -> f32 {
        match self {
            UnitType::Knights => 30.0,
            UnitType::Archers => 42.0,
            UnitType::Barbarians => 70.0,
        }
    }

    pub fn range(self) -> f32 {
        match self {
            UnitType::Knights => 0.0,
            UnitType::Archers => 240.0,
            UnitType::Barbarians => 0.0,
        }
    }

    pub fn dps(self) -> f32 {
        match self {
            UnitType::Knights => 1.0,
            UnitType::Archers => 0.9,
            UnitType::Barbarians => 1.3,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            UnitType::Knights => "K",
            UnitType::Archers => "A",
            UnitType::Barbarians => "B",
        }
    }

    pub fn multiplier(self, defender: UnitType) -> f32 {
        match (self, defender) {
            (UnitType::Knights, UnitType::Knights) => 1.0,
            (UnitType::Knights, UnitType::Archers) => 2.0,
            (UnitType::Knights, UnitType::Barbarians) => 0.5,

            (UnitType::Archers, UnitType::Knights) => 0.5,
            (UnitType::Archers, UnitType::Archers) => 1.0,
            (UnitType::Archers, UnitType::Barbarians) => 2.0,

            (UnitType::Barbarians, UnitType::Knights) => 2.0,
            (UnitType::Barbarians, UnitType::Archers) => 0.5,
            (UnitType::Barbarians, UnitType::Barbarians) => 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Stance {
    Advance,
    Hold,
    Retreat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GameMode {
    Strategic,
    Tactical,
    GameOver,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Squad {
    pub id: String,
    pub faction: Faction,
    pub x: f32,
    pub y: f32,
    #[serde(rename = "targetX")]
    pub target_x: f32,
    #[serde(rename = "targetY")]
    pub target_y: f32,
    pub condition: f32,
    pub knights: u32,
    pub archers: u32,
    pub barbarians: u32,
    #[serde(default)]
    pub veteran: bool,
    #[serde(rename = "mergeTargetId", default, skip_serializing_if = "Option::is_none")]
    pub merge_target_id: Option<String>,
}

impl Squad {
    pub fn total(&self) -> u32 {
        self.knights + self.archers + self.barbarians
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TacticalCohort {
    pub faction: Faction,
    #[serde(rename = "type")]
    pub unit_type: UnitType,
    pub hp: f32,
    pub x: f32,
    pub y: f32,
    pub stance: Stance,
    pub cooldown: f32,
    pub retreated: bool,
}

impl TacticalCohort {
    pub fn count(&self) -> u32 {
        if self.hp <= 0.0 {
            0
        } else {
            (self.hp / self.unit_type.hp() - 1e-6).ceil().max(0.0) as u32
        }
    }

    pub fn radius(&self) -> f32 {
        12.0 + (self.count() as f32).sqrt() * 3.2
    }

    pub fn is_active(&self) -> bool {
        self.hp > 0.0 && !self.retreated
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Arrow {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub t: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Battle {
    #[serde(rename = "attackerId")]
    pub attacker_id: String,
    #[serde(rename = "defenderId")]
    pub defender_id: String,
    pub terrain: TerrainType,
    pub cohorts: Vec<TacticalCohort>,
    pub arrows: Vec<Arrow>,
    #[serde(rename = "playerMountain")]
    pub player_mountain: bool,
    #[serde(rename = "aiMountain")]
    pub ai_mountain: bool,
    #[serde(rename = "playerCond")]
    pub player_cond: f32,
    #[serde(rename = "aiCond")]
    pub ai_cond: f32,
    #[serde(rename = "playerVeteran", default)]
    pub player_veteran: bool,
    #[serde(rename = "aiVeteran", default)]
    pub ai_veteran: bool,
    pub selected: Vec<UnitType>,
    #[serde(rename = "aiTimer")]
    pub ai_timer: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub mode: GameMode,
    pub winner: Option<Faction>,
    pub grid: Vec<Vec<TerrainType>>,
    #[serde(rename = "flagPosition")]
    pub flag_position: Point,
    #[serde(rename = "playerFlag")]
    pub player_flag: Point,
    pub squads: Vec<Squad>,
    #[serde(rename = "activeBattle")]
    pub active_battle: Option<Battle>,
    #[serde(rename = "selectedId")]
    pub selected_id: Option<String>,
    #[serde(rename = "aiTimer")]
    pub ai_timer: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameCommand {
    #[serde(rename = "SELECT_SQUAD")]
    SelectSquad {
        #[serde(rename = "squadId")]
        squad_id: Option<String>,
    },
    #[serde(rename = "MARCH_SQUAD")]
    MarchSquad {
        #[serde(rename = "squadId")]
        squad_id: String,
        #[serde(rename = "targetX")]
        target_x: f32,
        #[serde(rename = "targetY")]
        target_y: f32,
    },
    #[serde(rename = "COMBINE_SQUADS")]
    CombineSquads {
        #[serde(rename = "sourceId")]
        source_id: String,
        #[serde(rename = "targetId")]
        target_id: String,
    },
    #[serde(rename = "SELECT_TACTICAL")]
    SelectTactical {
        #[serde(rename = "unitType")]
        unit_type: String, // "all" | "knights" | "archers" | "barbarians"
    },
    #[serde(rename = "SET_TACTICAL_STANCE")]
    SetTacticalStance { stance: Stance },
    #[serde(rename = "RESTART_GAME")]
    RestartGame,
}

pub const MAP_ROWS: [&str; 12] = [
    "MMPPFFPPPPFFPPMM",
    "MPPPFPPTPPPFPPPM",
    "PPFFPPMMMMPPFFPP",
    "PPFFPPPMMPPPFFPP",
    "FFPPPTPPPPPPTPFF",
    "FPPMMPPFFPPMMPPF",
    "FPPMMPPFFPPMMPPF",
    "FFPTPPPPPPPPTPFF",
    "PPFFPPPMMPPPFFPP",
    "PPFFPPMMMMPPFFPP",
    "MPPPFPPPTPPFPPPM",
    "MMPPFFPPPPFFPPMM",
];

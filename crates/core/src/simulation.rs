use crate::types::*;

pub fn dist(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    ((x1 - x2).powi(2) + (y1 - y2).powi(2)).sqrt()
}

pub fn clamp(v: f32, lo: f32, hi: f32) -> f32 {
    v.max(lo).min(hi)
}

pub fn parse_map() -> Vec<Vec<TerrainType>> {
    MAP_ROWS
        .iter()
        .map(|row| {
            row.chars()
                .map(|c| match c {
                    'P' => TerrainType::Plains,
                    'F' => TerrainType::Forest,
                    'M' => TerrainType::Mountain,
                    'T' => TerrainType::Fort,
                    _ => TerrainType::Plains,
                })
                .collect()
        })
        .collect()
}

pub fn make_squad(id: &str, faction: Faction, x: f32, y: f32) -> Squad {
    Squad {
        id: id.to_string(),
        faction,
        x,
        y,
        target_x: x,
        target_y: y,
        condition: 100.0,
        knights: 15,
        archers: 15,
        barbarians: 15,
        veteran: false,
        merge_target_id: None,
    }
}

pub fn create_initial_state() -> GameState {
    let player_squad_x = [175.0, 325.0, 525.0, 675.0];
    let mut squads = Vec::new();
    for (i, &x) in player_squad_x.iter().enumerate() {
        squads.push(make_squad(&format!("P{}", i), Faction::Player, x, 510.0));
    }
    for (i, &x) in player_squad_x.iter().enumerate() {
        squads.push(make_squad(&format!("A{}", i), Faction::Ai, x, 90.0));
    }

    GameState {
        mode: GameMode::Strategic,
        winner: None,
        grid: parse_map(),
        flag_position: Point { x: 425.0, y: 40.0 },
        player_flag: Point { x: 425.0, y: 560.0 },
        squads,
        active_battle: None,
        selected_id: None,
        ai_timer: 1.0,
    }
}

#[derive(Debug, Clone)]
pub struct CoreGameEngine {
    pub state: GameState,
}

impl Default for CoreGameEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl CoreGameEngine {
    pub fn new() -> Self {
        Self {
            state: create_initial_state(),
        }
    }

    pub fn with_state(state: GameState) -> Self {
        Self { state }
    }

    pub fn dispatch(&mut self, command: GameCommand) {
        match command {
            GameCommand::SelectSquad { squad_id } => {
                if self.state.mode == GameMode::Strategic {
                    self.state.selected_id = squad_id;
                }
            }
            GameCommand::MarchSquad {
                squad_id,
                target_x,
                target_y,
            } => {
                if self.state.mode == GameMode::Strategic {
                    if let Some(s) = self.state.squads.iter_mut().find(|s| s.id == squad_id) {
                        if s.faction == Faction::Player {
                            s.target_x = clamp(target_x, 0.0, W);
                            s.target_y = clamp(target_y, 0.0, H);
                            s.merge_target_id = None;
                        }
                    }
                }
            }
            GameCommand::CombineSquads {
                source_id,
                target_id,
            } => {
                if self.state.mode == GameMode::Strategic {
                    self.combine_squads(&source_id, &target_id);
                }
            }
            GameCommand::SelectTactical { unit_type } => {
                if self.state.mode == GameMode::Tactical {
                    if let Some(ref mut b) = self.state.active_battle {
                        b.selected = match unit_type.as_str() {
                            "all" => UnitType::ALL.to_vec(),
                            "knights" => vec![UnitType::Knights],
                            "archers" => vec![UnitType::Archers],
                            "barbarians" => vec![UnitType::Barbarians],
                            _ => UnitType::ALL.to_vec(),
                        };
                    }
                }
            }
            GameCommand::SetTacticalStance { stance } => {
                if self.state.mode == GameMode::Tactical {
                    if let Some(ref mut b) = self.state.active_battle {
                        let selected = b.selected.clone();
                        for c in b.cohorts.iter_mut() {
                            if c.faction == Faction::Player
                                && c.is_active()
                                && (stance == Stance::Retreat || selected.contains(&c.unit_type))
                            {
                                c.stance = stance;
                            }
                        }
                    }
                }
            }
            GameCommand::RestartGame => {
                self.state = create_initial_state();
            }
        }
    }

    pub fn terrain_at(&self, x: f32, y: f32) -> TerrainType {
        let c = clamp((x / TILE).floor(), 0.0, (COLS - 1) as f32) as usize;
        let r = clamp((y / TILE).floor(), 0.0, (ROWS - 1) as f32) as usize;
        self.state.grid[r][c]
    }

    pub fn forts(&self) -> Vec<Point> {
        let mut out = Vec::new();
        for (r, row) in self.state.grid.iter().enumerate() {
            for (c, &t) in row.iter().enumerate() {
                if t == TerrainType::Fort {
                    out.push(Point {
                        x: c as f32 * TILE + 25.0,
                        y: r as f32 * TILE + 25.0,
                    });
                }
            }
        }
        out
    }

    pub fn tick(&mut self, dt: f32) {
        match self.state.mode {
            GameMode::Strategic => self.update_strategic(dt),
            GameMode::Tactical => self.update_tactical(dt),
            GameMode::GameOver => {}
        }
    }

    pub fn combine_squads(&mut self, source_id: &str, target_id: &str) -> bool {
        if source_id == target_id {
            return false;
        }

        let s1_idx = self.state.squads.iter().position(|s| s.id == source_id);
        let s2_idx = self.state.squads.iter().position(|s| s.id == target_id);

        let (idx1, idx2) = match (s1_idx, s2_idx) {
            (Some(i1), Some(i2)) => (i1, i2),
            _ => return false,
        };

        if self.state.squads[idx1].faction != self.state.squads[idx2].faction {
            return false;
        }

        let n1 = self.state.squads[idx1].total() as f32;
        let n2 = self.state.squads[idx2].total() as f32;
        if n1 == 0.0 || n2 == 0.0 {
            return false;
        }

        let k1 = self.state.squads[idx1].knights;
        let a1 = self.state.squads[idx1].archers;
        let b1 = self.state.squads[idx1].barbarians;
        let c1 = self.state.squads[idx1].condition;

        let s2 = &mut self.state.squads[idx2];
        s2.knights = (s2.knights + k1).min(25);
        s2.archers = (s2.archers + a1).min(25);
        s2.barbarians = (s2.barbarians + b1).min(25);

        let weighted_cond = (c1 * n1 + s2.condition * n2) / (n1 + n2);
        s2.condition = (weighted_cond + 15.0).round().min(100.0);
        s2.veteran = true;
        s2.merge_target_id = None;

        self.state.squads.retain(|s| s.id != source_id);
        if self.state.selected_id.as_deref() == Some(source_id) {
            self.state.selected_id = Some(target_id.to_string());
        }

        true
    }

    fn update_strategic(&mut self, dt: f32) {
        // Rendezvous tracking and auto-merge
        let mut merges_to_run = Vec::new();
        for i in 0..self.state.squads.len() {
            let s = &self.state.squads[i];
            if let Some(ref target_id) = s.merge_target_id {
                if let Some(tgt) = self.state.squads.iter().find(|t| t.id == *target_id) {
                    if tgt.faction == s.faction {
                        let target_pos = (tgt.x, tgt.y);
                        let s_pos = (s.x, s.y);
                        let d = dist(s_pos.0, s_pos.1, target_pos.0, target_pos.1);
                        if d <= 25.0 {
                            merges_to_run.push((s.id.clone(), tgt.id.clone()));
                        }
                    }
                }
            }
        }

        // Apply target position updates for squads pursuing a merge target
        for s in self.state.squads.iter_mut() {
            if let Some(ref target_id) = s.merge_target_id {
                let tid = target_id.clone();
                // We'll update coordinates below if target still exists
                s.merge_target_id = Some(tid);
            }
        }

        for (src, tgt) in merges_to_run {
            self.combine_squads(&src, &tgt);
        }

        // Update targetX/targetY towards moving merge targets
        let positions: Vec<(String, f32, f32)> = self
            .state
            .squads
            .iter()
            .map(|s| (s.id.clone(), s.x, s.y))
            .collect();

        for s in self.state.squads.iter_mut() {
            if let Some(ref target_id) = s.merge_target_id {
                if let Some((_, tx, ty)) = positions.iter().find(|(id, _, _)| id == target_id) {
                    s.target_x = *tx;
                    s.target_y = *ty;
                } else {
                    s.merge_target_id = None;
                }
            }
        }

        for s in self.state.squads.iter_mut() {
            let dx = s.target_x - s.x;
            let dy = s.target_y - s.y;
            let d = (dx * dx + dy * dy).sqrt();

            let c = clamp((s.x / TILE).floor(), 0.0, (COLS - 1) as f32) as usize;
            let r = clamp((s.y / TILE).floor(), 0.0, (ROWS - 1) as f32) as usize;
            let terr = self.state.grid[r][c];

            if d > 1.0 {
                let step = d.min(BASE_SPEED * terr.speed_mult() * (0.6 + s.condition / 250.0) * dt);
                s.x += (dx / d) * step;
                s.y += (dy / d) * step;
                s.condition = (s.condition - 2.5 * terr.drain_mult() * dt).max(0.0);
            } else {
                let recovery = if terr == TerrainType::Fort { 5.0 } else { 0.5 };
                s.condition = (s.condition + recovery * dt).min(100.0);
            }
        }

        self.state.ai_timer -= dt;
        if self.state.ai_timer <= 0.0 {
            self.ai_think();
            self.state.ai_timer = 2.0;
        }

        if self.check_win() {
            return;
        }

        // Check squad collisions for engagement
        let player_indices: Vec<usize> = self
            .state
            .squads
            .iter()
            .enumerate()
            .filter(|(_, s)| s.faction == Faction::Player)
            .map(|(i, _)| i)
            .collect();
        let ai_indices: Vec<usize> = self
            .state
            .squads
            .iter()
            .enumerate()
            .filter(|(_, s)| s.faction == Faction::Ai)
            .map(|(i, _)| i)
            .collect();

        for &pi in &player_indices {
            for &ai in &ai_indices {
                let p = &self.state.squads[pi];
                let a = &self.state.squads[ai];
                if dist(p.x, p.y, a.x, a.y) < ENGAGE_R {
                    self.start_battle(pi, ai);
                    return;
                }
            }
        }
    }

    fn check_win(&mut self) -> bool {
        let pl_count = self
            .state
            .squads
            .iter()
            .filter(|s| s.faction == Faction::Player)
            .count();
        let ai_count = self
            .state
            .squads
            .iter()
            .filter(|s| s.faction == Faction::Ai)
            .count();

        let pl_at_flag = self.state.squads.iter().any(|s| {
            s.faction == Faction::Player
                && dist(s.x, s.y, self.state.flag_position.x, self.state.flag_position.y) < FLAG_R
        });
        let ai_at_flag = self.state.squads.iter().any(|s| {
            s.faction == Faction::Ai
                && dist(s.x, s.y, self.state.player_flag.x, self.state.player_flag.y) < FLAG_R
        });

        let mut winner = None;
        if ai_count == 0 || pl_at_flag {
            winner = Some(Faction::Player);
        } else if pl_count == 0 || ai_at_flag {
            winner = Some(Faction::Ai);
        }

        if let Some(w) = winner {
            self.state.mode = GameMode::GameOver;
            self.state.winner = Some(w);
            true
        } else {
            false
        }
    }

    fn ai_think(&mut self) {
        let pl_targets: Vec<Point> = self
            .state
            .squads
            .iter()
            .filter(|s| s.faction == Faction::Player)
            .map(|s| Point { x: s.x, y: s.y })
            .collect();

        if pl_targets.is_empty() {
            return;
        }

        let forts = self.forts();
        let flag_pos = self.state.flag_position.clone();
        let player_flag = self.state.player_flag.clone();

        let mut busy_ids = Vec::new();

        // Find threats near AI flag
        let threat = self.state.squads.iter().find(|s| {
            s.faction == Faction::Player && dist(s.x, s.y, flag_pos.x, flag_pos.y) < 150.0
        }).map(|s| Point { x: s.x, y: s.y });

        // 0. Regroup decimated AI squads (< 12 men) with nearest friendly AI squad with capacity (< 45 men)
        let depleted_ai: Vec<(String, f32, f32)> = self
            .state
            .squads
            .iter()
            .filter(|s| s.faction == Faction::Ai && s.total() < 12)
            .map(|s| (s.id.clone(), s.x, s.y))
            .collect();

        for (dep_id, dep_x, dep_y) in depleted_ai {
            let allies: Vec<(String, f32, f32)> = self
                .state
                .squads
                .iter()
                .filter(|s| s.faction == Faction::Ai && s.id != dep_id && s.total() < 45)
                .map(|s| (s.id.clone(), s.x, s.y))
                .collect();

            if let Some((best_ally_id, ally_x, ally_y)) = allies.iter().min_by(|a, b| {
                dist(dep_x, dep_y, a.1, a.2)
                    .partial_cmp(&dist(dep_x, dep_y, b.1, b.2))
                    .unwrap()
            }) {
                if let Some(s) = self.state.squads.iter_mut().find(|s| s.id == dep_id) {
                    s.merge_target_id = Some(best_ally_id.clone());
                    s.target_x = *ally_x;
                    s.target_y = *ally_y;
                }
                busy_ids.push(dep_id);
            }
        }

        if let Some(th) = threat {
            // Find closest AI defender
            let def = self
                .state
                .squads
                .iter()
                .filter(|s| s.faction == Faction::Ai)
                .min_by(|a, b| {
                    dist(a.x, a.y, th.x, th.y)
                        .partial_cmp(&dist(b.x, b.y, th.x, th.y))
                        .unwrap()
                })
                .map(|s| s.id.clone());

            if let Some(def_id) = def {
                if let Some(s) = self.state.squads.iter_mut().find(|s| s.id == def_id) {
                    s.target_x = th.x;
                    s.target_y = th.y;
                }
                busy_ids.push(def_id);
            }
        }

        for i in 0..self.state.squads.len() {
            let s = &self.state.squads[i];
            if s.faction != Faction::Ai || busy_ids.contains(&s.id) {
                continue;
            }

            let c = clamp((s.x / TILE).floor(), 0.0, (COLS - 1) as f32) as usize;
            let r = clamp((s.y / TILE).floor(), 0.0, (ROWS - 1) as f32) as usize;
            let terr = self.state.grid[r][c];

            let resting = terr == TerrainType::Fort && s.condition < 90.0;
            if s.condition < 40.0 || resting {
                if let Some(f) = forts.iter().min_by(|a, b| {
                    dist(s.x, s.y, a.x, a.y)
                        .partial_cmp(&dist(s.x, s.y, b.x, b.y))
                        .unwrap()
                }) {
                    self.state.squads[i].target_x = f.x;
                    self.state.squads[i].target_y = f.y;
                }
                continue;
            }

            if s.condition > 70.0 {
                let mut targets = pl_targets.clone();
                targets.push(player_flag.clone());
                if let Some(tgt) = targets.iter().min_by(|a, b| {
                    dist(s.x, s.y, a.x, a.y)
                        .partial_cmp(&dist(s.x, s.y, b.x, b.y))
                        .unwrap()
                }) {
                    self.state.squads[i].target_x = tgt.x;
                    self.state.squads[i].target_y = tgt.y;
                }
            }
        }
    }

    fn start_battle(&mut self, player_idx: usize, ai_idx: usize) {
        let p = &self.state.squads[player_idx];
        let a = &self.state.squads[ai_idx];
        let mut cohorts = Vec::new();

        let layout = [
            (UnitType::Knights, 210.0, 120.0),
            (UnitType::Archers, 90.0, 200.0),
            (UnitType::Barbarians, 210.0, 280.0),
        ];

        for (sq, faction) in [(p, Faction::Player), (a, Faction::Ai)] {
            for (ut, lx, ly) in layout {
                let count = match ut {
                    UnitType::Knights => sq.knights,
                    UnitType::Archers => sq.archers,
                    UnitType::Barbarians => sq.barbarians,
                };
                if count > 0 {
                    let x = if faction == Faction::Player { lx } else { AW - lx };
                    cohorts.push(TacticalCohort {
                        faction,
                        unit_type: ut,
                        hp: count as f32 * ut.hp(),
                        x,
                        y: ly,
                        stance: Stance::Hold,
                        cooldown: 0.2,
                        retreated: false,
                    });
                }
            }
        }

        let mid_x = (p.x + a.x) / 2.0;
        let mid_y = (p.y + a.y) / 2.0;
        let p_mountain = self.terrain_at(p.x, p.y) == TerrainType::Mountain;
        let a_mountain = self.terrain_at(a.x, a.y) == TerrainType::Mountain;

        let p_veteran = p.veteran;
        let a_veteran = a.veteran;

        self.state.active_battle = Some(Battle {
            attacker_id: p.id.clone(),
            defender_id: a.id.clone(),
            terrain: self.terrain_at(mid_x, mid_y),
            cohorts,
            arrows: Vec::new(),
            player_mountain: p_mountain,
            ai_mountain: a_mountain,
            player_cond: p.condition,
            ai_cond: a.condition,
            player_veteran: p_veteran,
            ai_veteran: a_veteran,
            selected: UnitType::ALL.to_vec(),
            ai_timer: 0.0,
        });

        self.state.selected_id = None;
        self.state.mode = GameMode::Tactical;
    }

    fn update_tactical(&mut self, dt: f32) {
        let b = match self.state.active_battle.as_mut() {
            Some(b) => b,
            None => return,
        };

        b.ai_timer -= dt;
        if b.ai_timer <= 0.0 {
            Self::ai_tactical(b);
            b.ai_timer = 0.5;
        }

        let cohorts_len = b.cohorts.len();
        for i in 0..cohorts_len {
            if !b.cohorts[i].is_active() {
                continue;
            }

            let c_type = b.cohorts[i].unit_type;
            let c_faction = b.cohorts[i].faction;
            let c_stance = b.cohorts[i].stance;
            let c_speed = c_type.speed();
            let c_radius = b.cohorts[i].radius();

            if c_stance == Stance::Retreat {
                let edge_x = if c_faction == Faction::Player { 0.0 } else { AW };
                let dir = (edge_x - b.cohorts[i].x).signum();
                b.cohorts[i].x += dir * c_speed * 1.2 * dt;
                if (c_faction == Faction::Player && b.cohorts[i].x - c_radius <= 0.0)
                    || (c_faction == Faction::Ai && b.cohorts[i].x + c_radius >= AW)
                {
                    b.cohorts[i].retreated = true;
                }
                continue;
            }

            // Find closest active foe
            let mut best_target: Option<(usize, f32)> = None;
            for j in 0..cohorts_len {
                if b.cohorts[j].faction != c_faction && b.cohorts[j].is_active() {
                    let d = dist(
                        b.cohorts[i].x,
                        b.cohorts[i].y,
                        b.cohorts[j].x,
                        b.cohorts[j].y,
                    );
                    if best_target.map_or(true, |(_, best_d)| d < best_d) {
                        best_target = Some((j, d));
                    }
                }
            }

            if let Some((tgt_idx, d)) = best_target {
                let tgt_radius = b.cohorts[tgt_idx].radius();
                let edge = d - c_radius - tgt_radius;
                let reach = if c_type.range() > 0.0 { c_type.range() } else { 4.0 };

                if edge <= reach {
                    if c_type == UnitType::Archers {
                        b.cohorts[i].cooldown -= dt;
                        if b.cohorts[i].cooldown <= 0.0 {
                            b.cohorts[i].cooldown = 1.0;
                            let count = b.cohorts[i].count() as f32;
                            let dmg = count * c_type.dps();
                            Self::deal_damage_to_target(b, i, tgt_idx, dmg);
                            b.arrows.push(Arrow {
                                x1: b.cohorts[i].x,
                                y1: b.cohorts[i].y,
                                x2: b.cohorts[tgt_idx].x,
                                y2: b.cohorts[tgt_idx].y,
                                t: 0.0,
                            });
                        }
                    } else {
                        let count = b.cohorts[i].count() as f32;
                        let dmg = count * c_type.dps() * dt;
                        Self::deal_damage_to_target(b, i, tgt_idx, dmg);
                    }
                } else if c_stance == Stance::Advance {
                    let step = (edge - reach + 1.0).min(c_speed * dt);
                    let tgt_x = b.cohorts[tgt_idx].x;
                    let tgt_y = b.cohorts[tgt_idx].y;
                    b.cohorts[i].x += ((tgt_x - b.cohorts[i].x) / d) * step;
                    b.cohorts[i].y += ((tgt_y - b.cohorts[i].y) / d) * step;
                }
            }

            b.cohorts[i].x = clamp(b.cohorts[i].x, 0.0, AW);
            b.cohorts[i].y = clamp(b.cohorts[i].y, c_radius, AH - c_radius);
        }

        // Separate allied blocks
        for i in 0..cohorts_len {
            for j in 0..cohorts_len {
                if i == j
                    || b.cohorts[i].faction != b.cohorts[j].faction
                    || !b.cohorts[i].is_active()
                    || !b.cohorts[j].is_active()
                {
                    continue;
                }
                let mut d = dist(
                    b.cohorts[i].x,
                    b.cohorts[i].y,
                    b.cohorts[j].x,
                    b.cohorts[j].y,
                );
                if d <= 0.0 {
                    d = 0.01;
                }
                let min_d = b.cohorts[i].radius() + b.cohorts[j].radius();
                if d < min_d {
                    let push = (min_d - d) / 2.0;
                    let dx = b.cohorts[i].x - b.cohorts[j].x;
                    let dy = b.cohorts[i].y - b.cohorts[j].y;
                    b.cohorts[i].x += (dx / d) * push;
                    b.cohorts[i].y += (dy / d) * push;
                }
            }
        }

        // Advance arrows
        for a in b.arrows.iter_mut() {
            a.t += dt * 3.0;
        }
        b.arrows.retain(|a| a.t < 1.0);

        let p_active = b.cohorts.iter().any(|c| c.faction == Faction::Player && c.is_active());
        let a_active = b.cohorts.iter().any(|c| c.faction == Faction::Ai && c.is_active());

        if !p_active || !a_active {
            self.end_battle(p_active, a_active);
        }
    }

    fn deal_damage_to_target(b: &mut Battle, att_idx: usize, def_idx: usize, base: f32) {
        let att_faction = b.cohorts[att_idx].faction;
        let att_type = b.cohorts[att_idx].unit_type;
        let def_faction = b.cohorts[def_idx].faction;
        let def_type = b.cohorts[def_idx].unit_type;

        let cond = if att_faction == Faction::Player {
            b.player_cond
        } else {
            b.ai_cond
        };
        let cond_mult = 0.5 + cond / 200.0;
        let def_bonus = if (def_faction == Faction::Player && b.player_mountain)
            || (def_faction == Faction::Ai && b.ai_mountain)
        {
            1.25
        } else {
            1.0
        };
        let vet_bonus = if (att_faction == Faction::Player && b.player_veteran)
            || (att_faction == Faction::Ai && b.ai_veteran)
        {
            1.10
        } else {
            1.0
        };

        let mult = att_type.multiplier(def_type);
        b.cohorts[def_idx].hp -= (base * mult * cond_mult * vet_bonus) / def_bonus;
    }

    fn ai_tactical(b: &mut Battle) {
        let ai_sum: u32 = b
            .cohorts
            .iter()
            .filter(|c| c.faction == Faction::Ai && c.is_active())
            .map(|c| c.count())
            .sum();
        let pl_sum: u32 = b
            .cohorts
            .iter()
            .filter(|c| c.faction == Faction::Player && c.is_active())
            .map(|c| c.count())
            .sum();

        if (ai_sum as f32) < 0.25 * (pl_sum as f32) {
            for c in b.cohorts.iter_mut() {
                if c.faction == Faction::Ai && c.is_active() {
                    c.stance = Stance::Retreat;
                }
            }
            return;
        }

        let ai_archers: u32 = b
            .cohorts
            .iter()
            .filter(|c| c.faction == Faction::Ai && c.is_active() && c.unit_type == UnitType::Archers)
            .map(|c| c.count())
            .sum();
        let pl_archers: u32 = b
            .cohorts
            .iter()
            .filter(|c| c.faction == Faction::Player && c.is_active() && c.unit_type == UnitType::Archers)
            .map(|c| c.count())
            .sum();

        for c in b.cohorts.iter_mut() {
            if c.faction != Faction::Ai || !c.is_active() || c.stance == Stance::Retreat {
                continue;
            }
            c.stance = if c.unit_type == UnitType::Archers {
                if ai_archers > pl_archers {
                    Stance::Hold
                } else {
                    Stance::Advance
                }
            } else {
                Stance::Advance
            };
        }
    }

    fn end_battle(&mut self, p_active: bool, a_active: bool) {
        let b = match self.state.active_battle.take() {
            Some(b) => b,
            None => return,
        };

        let mut p_survivors = (0, 0, 0);
        let mut a_survivors = (0, 0, 0);

        for c in &b.cohorts {
            if c.hp > 0.0 {
                let cnt = c.count();
                let target = if c.faction == Faction::Player {
                    &mut p_survivors
                } else {
                    &mut a_survivors
                };
                match c.unit_type {
                    UnitType::Knights => target.0 += cnt,
                    UnitType::Archers => target.1 += cnt,
                    UnitType::Barbarians => target.2 += cnt,
                }
            }
        }

        if let Some(p) = self.state.squads.iter_mut().find(|s| s.id == b.attacker_id) {
            p.knights = p_survivors.0;
            p.archers = p_survivors.1;
            p.barbarians = p_survivors.2;
            p.condition = (p.condition - 10.0).max(0.0);
        }

        if let Some(a) = self.state.squads.iter_mut().find(|s| s.id == b.defender_id) {
            a.knights = a_survivors.0;
            a.archers = a_survivors.1;
            a.barbarians = a_survivors.2;
            a.condition = (a.condition - 10.0).max(0.0);
        }

        // Pushback loser
        let p_pos = self
            .state
            .squads
            .iter()
            .find(|s| s.id == b.attacker_id)
            .map(|s| (s.x, s.y));
        let a_pos = self
            .state
            .squads
            .iter()
            .find(|s| s.id == b.defender_id)
            .map(|s| (s.x, s.y));

        if let (Some((px, py)), Some((ax, ay))) = (p_pos, a_pos) {
            if !p_active {
                if let Some(p) = self.state.squads.iter_mut().find(|s| s.id == b.attacker_id) {
                    let d = dist(px, py, ax, ay).max(1.0);
                    let ux = (px - ax) / d;
                    let uy = if d > 1.0 { (py - ay) / d } else { 1.0 };
                    p.x = clamp(p.x + ux * 60.0, 10.0, W - 10.0);
                    p.y = clamp(p.y + uy * 60.0, 10.0, H - 10.0);
                    p.target_x = p.x;
                    p.target_y = p.y;
                }
            }
            if !a_active {
                if let Some(a) = self.state.squads.iter_mut().find(|s| s.id == b.defender_id) {
                    let d = dist(ax, ay, px, py).max(1.0);
                    let ux = (ax - px) / d;
                    let uy = if d > 1.0 { (ay - py) / d } else { -1.0 };
                    a.x = clamp(a.x + ux * 60.0, 10.0, W - 10.0);
                    a.y = clamp(a.y + uy * 60.0, 10.0, H - 10.0);
                    a.target_x = a.x;
                    a.target_y = a.y;
                }
            }
            if p_active {
                if let Some(p) = self.state.squads.iter_mut().find(|s| s.id == b.attacker_id) {
                    p.target_x = p.x;
                    p.target_y = p.y;
                }
            }
        }

        self.state.squads.retain(|s| s.total() > 0);
        self.state.active_battle = None;
        self.state.mode = GameMode::Strategic;
        self.check_win();
    }
}

pub mod ffi;
pub mod simulation;
pub mod types;

pub use ffi::*;
pub use simulation::CoreGameEngine;
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let engine = CoreGameEngine::new();
        assert_eq!(engine.state.mode, GameMode::Strategic);
        assert_eq!(engine.state.squads.len(), 8);
        assert_eq!(engine.state.grid.len(), ROWS);
        assert_eq!(engine.state.grid[0].len(), COLS);
    }

    #[test]
    fn test_march_command() {
        let mut engine = CoreGameEngine::new();
        engine.dispatch(GameCommand::MarchSquad {
            squad_id: "P0".to_string(),
            target_x: 200.0,
            target_y: 400.0,
        });

        let s = engine.state.squads.iter().find(|s| s.id == "P0").unwrap();
        assert_eq!(s.target_x, 200.0);
        assert_eq!(s.target_y, 400.0);

        // Tick simulation
        let initial_cond = s.condition;
        let initial_y = s.y;
        engine.tick(0.1);

        let s_after = engine.state.squads.iter().find(|s| s.id == "P0").unwrap();
        assert!(s_after.y < initial_y);
        assert!(s_after.condition < initial_cond);
    }

    #[test]
    fn test_battle_engagement() {
        let mut engine = CoreGameEngine::new();
        let a0_pos = {
            let a0 = engine.state.squads.iter().find(|s| s.id == "A0").unwrap();
            (a0.x, a0.y)
        };

        if let Some(p0) = engine.state.squads.iter_mut().find(|s| s.id == "P0") {
            p0.x = a0_pos.0;
            p0.y = a0_pos.1 + 10.0;
            p0.target_x = a0_pos.0;
            p0.target_y = a0_pos.1;
        }

        engine.tick(0.05);

        assert_eq!(engine.state.mode, GameMode::Tactical);
        assert!(engine.state.active_battle.is_some());
    }

    #[test]
    fn test_ffi_lifecycle() {
        engine_reset();
        assert_eq!(engine_get_mode(), 0);
        engine_tick(0.1);
        let len = engine_get_state_json_len();
        assert!(len > 0);
        let ptr = engine_get_state_json_ptr();
        assert!(!ptr.is_null());
    }

    #[test]
    fn test_rock_paper_scissors_multipliers() {
        assert_eq!(UnitType::Knights.multiplier(UnitType::Archers), 2.0);
        assert_eq!(UnitType::Knights.multiplier(UnitType::Barbarians), 0.5);
        assert_eq!(UnitType::Archers.multiplier(UnitType::Barbarians), 2.0);
        assert_eq!(UnitType::Archers.multiplier(UnitType::Knights), 0.5);
        assert_eq!(UnitType::Barbarians.multiplier(UnitType::Knights), 2.0);
        assert_eq!(UnitType::Barbarians.multiplier(UnitType::Archers), 0.5);
    }

    #[test]
    fn test_condition_recovery_in_fort() {
        let mut engine = CoreGameEngine::new();
        // Place squad 0 inside first fort
        let fort = engine.forts()[0].clone();
        if let Some(s) = engine.state.squads.iter_mut().find(|s| s.id == "P0") {
            s.x = fort.x;
            s.y = fort.y;
            s.target_x = fort.x;
            s.target_y = fort.y;
            s.condition = 50.0;
        }

        // 2 seconds of idle simulation in fort -> +10.0 condition
        engine.tick(2.0);

        let s = engine.state.squads.iter().find(|s| s.id == "P0").unwrap();
        assert!((s.condition - 60.0).abs() < 0.2);
    }

    #[test]
    fn test_win_by_flag_capture() {
        let mut engine = CoreGameEngine::new();
        let flag = engine.state.flag_position.clone();
        if let Some(s) = engine.state.squads.iter_mut().find(|s| s.id == "P0") {
            s.x = flag.x;
            s.y = flag.y;
            s.target_x = flag.x;
            s.target_y = flag.y;
        }

        engine.tick(0.1);

        assert_eq!(engine.state.mode, GameMode::GameOver);
        assert_eq!(engine.state.winner, Some(Faction::Player));
    }

    #[test]
    fn test_combine_squads() {
        let mut engine = CoreGameEngine::new();
        // Setup P0 with 5 knights, 2 archers, 3 barbarians (10 total), condition 50
        if let Some(p0) = engine.state.squads.iter_mut().find(|s| s.id == "P0") {
            p0.knights = 5;
            p0.archers = 2;
            p0.barbarians = 3;
            p0.condition = 50.0;
        }
        // Setup P1 with 10 knights, 5 archers, 5 barbarians (20 total), condition 70
        if let Some(p1) = engine.state.squads.iter_mut().find(|s| s.id == "P1") {
            p1.knights = 10;
            p1.archers = 5;
            p1.barbarians = 5;
            p1.condition = 70.0;
        }

        let ok = engine.combine_squads("P0", "P1");
        assert!(ok);
        assert!(!engine.state.squads.iter().any(|s| s.id == "P0"));

        let p1 = engine.state.squads.iter().find(|s| s.id == "P1").unwrap();
        assert_eq!(p1.knights, 15);
        assert_eq!(p1.archers, 7);
        assert_eq!(p1.barbarians, 8);
        assert_eq!(p1.total(), 30);
        assert!(p1.veteran);
        // Weighted average: (50*10 + 70*20) / 30 = (500 + 1400)/30 = 63.33 + 15 = 78.33 -> round 78.0
        assert_eq!(p1.condition, 78.0);
    }

    #[test]
    fn test_tactical_retreat_and_turnaround() {
        let mut engine = CoreGameEngine::new();
        let a0_pos = {
            let a0 = engine.state.squads.iter().find(|s| s.id == "A0").unwrap();
            (a0.x, a0.y)
        };
        if let Some(p0) = engine.state.squads.iter_mut().find(|s| s.id == "P0") {
            p0.x = a0_pos.0;
            p0.y = a0_pos.1 + 10.0;
            p0.target_x = a0_pos.0;
            p0.target_y = a0_pos.1;
        }

        engine.tick(0.05);
        assert_eq!(engine.state.mode, GameMode::Tactical);

        // Order retreat
        engine.dispatch(GameCommand::SetTacticalStance {
            stance: Stance::Retreat,
        });
        let b = engine.state.active_battle.as_ref().unwrap();
        assert!(b
            .cohorts
            .iter()
            .filter(|c| c.faction == Faction::Player && c.is_active())
            .all(|c| c.stance == Stance::Retreat));

        // Now issue Advance: all player cohorts should turn around to Advance
        engine.dispatch(GameCommand::SetTacticalStance {
            stance: Stance::Advance,
        });
        let b = engine.state.active_battle.as_ref().unwrap();
        assert!(b
            .cohorts
            .iter()
            .filter(|c| c.faction == Faction::Player && c.is_active())
            .all(|c| c.stance == Stance::Advance));
    }
}

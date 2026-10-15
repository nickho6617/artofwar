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
}

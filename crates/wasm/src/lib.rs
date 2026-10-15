use wasm_bindgen::prelude::*;
use artofwar_core::{CoreGameEngine, GameCommand};

#[wasm_bindgen]
pub struct WasmEngine {
    engine: CoreGameEngine,
}

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        Self {
            engine: CoreGameEngine::new(),
        }
    }

    #[wasm_bindgen]
    pub fn dispatch(&mut self, val: JsValue) -> Result<(), JsValue> {
        let cmd: GameCommand = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse command: {}", e)))?;
        self.engine.dispatch(cmd);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn dispatch_json(&mut self, json_str: &str) -> Result<(), JsValue> {
        let cmd: GameCommand = serde_json::from_str(json_str)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse command JSON: {}", e)))?;
        self.engine.dispatch(cmd);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn tick(&mut self, dt: f32) {
        self.engine.tick(dt);
    }

    #[wasm_bindgen]
    pub fn get_state(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.engine.state)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize state: {}", e)))
    }

    #[wasm_bindgen]
    pub fn get_state_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.engine.state)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize state JSON: {}", e)))
    }
}

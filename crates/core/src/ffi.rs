use crate::simulation::CoreGameEngine;
use crate::types::*;
use std::cell::RefCell;
use std::slice;

thread_local! {
    static ENGINE: RefCell<CoreGameEngine> = RefCell::new(CoreGameEngine::new());
    static JSON_BUFFER: RefCell<Vec<u8>> = RefCell::new(Vec::new());
}

#[no_mangle]
pub extern "C" fn engine_alloc(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn engine_dealloc(ptr: *mut u8, size: usize) {
    if !ptr.is_null() && size > 0 {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

#[no_mangle]
pub extern "C" fn engine_reset() {
    ENGINE.with(|e| {
        *e.borrow_mut() = CoreGameEngine::new();
    });
}

#[no_mangle]
pub extern "C" fn engine_tick(dt: f32) {
    ENGINE.with(|e| {
        e.borrow_mut().tick(dt);
    });
}

#[no_mangle]
pub unsafe extern "C" fn engine_dispatch_json(ptr: *const u8, len: usize) -> i32 {
    if ptr.is_null() || len == 0 {
        return -1;
    }
    let slice = slice::from_raw_parts(ptr, len);
    let cmd: Result<GameCommand, _> = serde_json::from_slice(slice);
    match cmd {
        Ok(c) => {
            ENGINE.with(|e| {
                e.borrow_mut().dispatch(c);
            });
            0
        }
        Err(_) => -2,
    }
}

#[no_mangle]
pub extern "C" fn engine_get_state_json_len() -> usize {
    ENGINE.with(|e| {
        let eng = e.borrow();
        match serde_json::to_vec(&eng.state) {
            Ok(bytes) => {
                let len = bytes.len();
                JSON_BUFFER.with(|b| {
                    *b.borrow_mut() = bytes;
                });
                len
            }
            Err(_) => 0,
        }
    })
}

#[no_mangle]
pub extern "C" fn engine_get_state_json_ptr() -> *const u8 {
    JSON_BUFFER.with(|b| b.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn engine_get_mode() -> i32 {
    ENGINE.with(|e| match e.borrow().state.mode {
        GameMode::Strategic => 0,
        GameMode::Tactical => 1,
        GameMode::GameOver => 2,
    })
}

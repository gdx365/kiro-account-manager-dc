#![allow(clippy::needless_pass_by_value)]

mod types;
mod utils;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

pub use types::*;
pub use utils::{generate_random_machine_id, get_machine_id};

#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(target_os = "windows")]
use windows as platform;

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
mod platform {
    use super::types::*;

    const ERR: &str = "当前仅支持 Windows、macOS 和 Linux";

    pub fn get_system_machine_guid_inner() -> Result<SystemMachineInfo, String> {
        Err(ERR.into())
    }

    pub fn reset_machine_guid_inner() -> Result<String, String> {
        Err(ERR.into())
    }

    pub fn set_custom_machine_guid_inner(_: String) -> Result<String, String> {
        Err(ERR.into())
    }
}

async fn run<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| format!("Task failed: {e}"))
}

#[tauri::command]
pub async fn get_system_machine_guid() -> Result<SystemMachineInfo, String> {
    run(platform::get_system_machine_guid_inner).await?
}

#[tauri::command]
pub async fn reset_system_machine_guid() -> Result<String, String> {
    run(platform::reset_machine_guid_inner).await?
}

#[tauri::command]
pub async fn set_custom_machine_guid(new_guid: String) -> Result<String, String> {
    run(move || platform::set_custom_machine_guid_inner(new_guid)).await?
}

#[tauri::command]
pub fn generate_machine_guid() -> String {
    generate_random_machine_id()
}

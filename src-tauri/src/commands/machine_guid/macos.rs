use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use uuid::Uuid;

use super::types::SystemMachineInfo;
use super::utils::*;

fn get_kiro_data_dir() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(|home| {
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Kiro")
    })
}

fn get_kiro_machineid_path() -> Option<PathBuf> {
    get_kiro_data_dir().map(|p| p.join("machineid"))
}

fn get_storage_json_path() -> Option<PathBuf> {
    get_kiro_data_dir().map(|p| p.join("User").join("globalStorage").join("storage.json"))
}

fn read_hardware_uuid() -> Result<String, String> {
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| format!("执行 ioreg 失败: {e}"))?;

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|l| l.contains("IOPlatformUUID"))
        .and_then(|l| l.split('"').nth(3).map(|s| s.to_lowercase()))
        .ok_or_else(|| "无法获取 IOPlatformUUID".to_string())
}

fn sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn write_all_machine_ids(machine_id: &str) -> Result<(), String> {
    let machineid_path = get_kiro_machineid_path().ok_or("无法获取 Kiro machineid 路径")?;

    if let Some(parent) = machineid_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }

    fs::write(&machineid_path, machine_id).map_err(|e| format!("写入 Kiro machineid 失败: {e}"))?;

    if let Some(storage_path) = get_storage_json_path() {
        if storage_path.exists() {
            update_storage_json(&storage_path, machine_id)?;
        }
    }

    Ok(())
}

fn update_storage_json(path: &PathBuf, machine_id: &str) -> Result<(), String> {
    let content = fs::read_to_string(path).map_err(|e| format!("读取 storage.json 失败: {e}"))?;

    let mut json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 storage.json 失败: {e}"))?;

    if let Some(obj) = json.as_object_mut() {
        obj.insert(
            "telemetry.machineId".to_string(),
            serde_json::Value::String(sha256_hash(machine_id)),
        );
        obj.insert(
            "telemetry.devDeviceId".to_string(),
            serde_json::Value::String(Uuid::new_v4().to_string().to_lowercase()),
        );
        obj.insert(
            "telemetry.sqmId".to_string(),
            serde_json::Value::String(format!("{{{}}}", Uuid::new_v4().to_string().to_uppercase())),
        );
    }

    let new_content =
        serde_json::to_string_pretty(&json).map_err(|e| format!("序列化 storage.json 失败: {e}"))?;

    fs::write(path, new_content).map_err(|e| format!("写入 storage.json 失败: {e}"))?;

    Ok(())
}

pub fn get_system_machine_guid_inner() -> Result<SystemMachineInfo, String> {
    let machine_guid = if let Some(path) = get_kiro_machineid_path() {
        if path.exists() {
            fs::read_to_string(&path)
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| is_valid_machine_id(s))
        } else {
            None
        }
    } else {
        None
    }
    .map_or_else(|| read_hardware_uuid(), Ok)?;

    Ok(SystemMachineInfo {
        machine_guid: Some(machine_guid),
        backup_exists: false,
        backup_time: None,
        os_type: "macos".to_string(),
        can_modify: true,
        requires_admin: false,
    })
}

pub fn reset_machine_guid_inner() -> Result<String, String> {
    let new_guid = Uuid::new_v4().to_string().to_lowercase();
    write_all_machine_ids(&new_guid)?;
    Ok(new_guid)
}

pub fn set_custom_machine_guid_inner(new_guid: String) -> Result<String, String> {
    if !is_valid_machine_id(&new_guid) {
        return Err("无效的机器码格式".to_string());
    }
    let formatted = new_guid.to_lowercase();
    write_all_machine_ids(&formatted)?;
    Ok(formatted)
}

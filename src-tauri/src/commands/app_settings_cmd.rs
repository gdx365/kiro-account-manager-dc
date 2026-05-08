// 搴旂敤鑷韩璁剧疆鍛戒护 (瀛樺埌 ~/.kiro-account-manager/app-settings.json)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: Option<String>,
    pub locale: Option<String>, // 鐣岄潰璇█
    pub lock_model: Option<bool>,
    pub locked_model: Option<String>,
    pub auto_refresh: Option<bool>,
    pub auto_refresh_interval: Option<i32>,
    pub auto_change_machine_id: Option<bool>, // Whether to change machine id when switching account (default: true)
    pub browser_path: Option<String>,
    // Privacy mode: mask email display
    pub privacy_mode: Option<bool>,
    // Auto switch settings
    pub auto_switch_enabled: Option<bool>,
    pub auto_switch_threshold: Option<f64>,
    pub auto_switch_interval: Option<i32>,
    // Kiro IDE feature preferences
    pub enable_codebase_indexing: Option<bool>,
    pub enable_tab_autocomplete: Option<bool>,
    pub usage_summary: Option<bool>,
    pub code_references: Option<bool>,
    pub enable_debug_logs: Option<bool>,
    pub notify_action_required: Option<bool>,
    pub notify_failure: Option<bool>,
    pub notify_success: Option<bool>,
    pub notify_billing: Option<bool>,
    // 鏂板 Kiro IDE 璁剧疆
    pub trusted_tools: Option<Vec<String>>,
    pub reference_tracker: Option<bool>,
    pub configure_mcp: Option<String>,
    pub telemetry_content_collection: Option<bool>,
    pub telemetry_usage_analytics: Option<bool>,
    pub telemetry_edit_stats: Option<bool>,
    pub telemetry_feedback: Option<bool>,
}

// Compatibility note: legacy `redeem_server` field is ignored on read and no longer written
// 璇诲彇鏃跺拷鐣ワ紝涓嶅啀鍐欏叆

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Some("dark".to_string()),
            locale: Some("zh-CN".to_string()),
            lock_model: Some(false),
            locked_model: None,
            auto_refresh: Some(true),
            auto_refresh_interval: Some(50),
            auto_change_machine_id: Some(true), // 榛樿寮€鍚?
            browser_path: None,
            privacy_mode: Some(true), // 榛樿寮€鍚?
            // Default values for auto-switch
            auto_switch_enabled: Some(false),
            auto_switch_threshold: Some(1.0),
            auto_switch_interval: Some(5),
            // Kiro IDE 寮€鍏抽粯璁ゅ€?
            enable_codebase_indexing: Some(true),
            enable_tab_autocomplete: Some(true),
            usage_summary: Some(true),
            code_references: Some(true),
            enable_debug_logs: Some(false),
            notify_action_required: Some(true),
            notify_failure: Some(true),
            notify_success: Some(true),
            notify_billing: Some(true),
            trusted_tools: None,
            reference_tracker: Some(false),
            configure_mcp: Some("Enabled".to_string()),
            telemetry_content_collection: Some(false),
            telemetry_usage_analytics: Some(false),
            telemetry_edit_stats: Some(false),
            telemetry_feedback: Some(false),
        }
    }
}

impl AppSettings {
    fn apply_updates(&mut self, updates: Self) {
        macro_rules! apply_if_some {
            ($field:ident) => {
                if updates.$field.is_some() {
                    self.$field = updates.$field;
                }
            };
        }

        apply_if_some!(theme);
        apply_if_some!(locale);
        apply_if_some!(lock_model);
        apply_if_some!(locked_model);
        apply_if_some!(auto_refresh);
        apply_if_some!(auto_refresh_interval);
        apply_if_some!(auto_change_machine_id);
        apply_if_some!(browser_path);
        apply_if_some!(privacy_mode);
        apply_if_some!(auto_switch_enabled);
        apply_if_some!(auto_switch_threshold);
        apply_if_some!(auto_switch_interval);
        apply_if_some!(enable_codebase_indexing);
        apply_if_some!(enable_tab_autocomplete);
        apply_if_some!(usage_summary);
        apply_if_some!(code_references);
        apply_if_some!(enable_debug_logs);
        apply_if_some!(notify_action_required);
        apply_if_some!(notify_failure);
        apply_if_some!(notify_success);
        apply_if_some!(notify_billing);
        apply_if_some!(trusted_tools);
        apply_if_some!(reference_tracker);
        apply_if_some!(configure_mcp);
        apply_if_some!(telemetry_content_collection);
        apply_if_some!(telemetry_usage_analytics);
        apply_if_some!(telemetry_edit_stats);
        apply_if_some!(telemetry_feedback);
    }
}

fn get_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| {
            let home = std::env::var("USERPROFILE")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home)
        })
        .join(".kiro-account-manager")
}

fn get_app_settings_path() -> PathBuf {
    get_data_dir().join("app-settings.json")
}

fn ensure_parent_dir(path: &std::path::Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("鍒涘缓鐩綍澶辫触: {e}"))?;
    }
    Ok(())
}

async fn run_blocking_io<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(task)
        .await
        .map_err(|e| format!("Task failed: {e}"))?
}

pub fn get_app_settings_inner() -> Result<AppSettings, String> {
    let path = get_app_settings_path();
    if !path.exists() {
        // First run: create and persist default settings
        let default_settings = AppSettings::default();
        save_settings_to_file(&default_settings)?;
        return Ok(default_settings);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("璇诲彇璁剧疆澶辫触: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("瑙ｆ瀽璁剧疆澶辫触: {e}"))
}

pub fn save_settings_to_file(settings: &AppSettings) -> Result<(), String> {
    let path = get_app_settings_path();
    ensure_parent_dir(&path)?;
    let content = serde_json::to_string_pretty(settings).map_err(|e| format!("搴忓垪鍖栧け璐? {e}"))?;
    std::fs::write(&path, content).map_err(|e| format!("鍐欏叆澶辫触: {e}"))
}

fn save_app_settings_inner(updates: AppSettings) -> Result<(), String> {
    let mut current = get_app_settings_inner().unwrap_or_default();

    current.apply_updates(updates);

    save_settings_to_file(&current)
}

#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    run_blocking_io(get_app_settings_inner).await
}

#[tauri::command]
pub async fn save_app_settings(settings: AppSettings) -> Result<(), String> {
    run_blocking_io(move || save_app_settings_inner(settings)).await
}

/// Get custom browser path for external URL opening
pub fn get_browser_path() -> Option<String> {
    get_app_settings_inner()
        .ok()
        .and_then(|s| s.browser_path)
        .filter(|p| !p.is_empty())
}

#[cfg(windows)]
fn write_protocol_mapping(exe_path: &str) -> Result<String, String> {
    use std::path::Path;
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let normalized = exe_path.trim().trim_matches('"');
    if normalized.is_empty() {
        return Err("鍗忚鏄犲皠璺緞涓嶈兘涓虹┖".to_string());
    }
    if !Path::new(normalized).exists() {
        return Err(format!("鐩爣鏂囦欢涓嶅瓨鍦? {normalized}"));
    }

    let command = format!("\"{normalized}\" \"%1\"");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for scheme in ["kiro", "kiro-account-manager"] {
        let class_path = format!("Software\\Classes\\{scheme}");
        let (class_key, _) = hkcu
            .create_subkey(&class_path)
            .map_err(|e| format!("创建协议键失败（{scheme}）: {e}"))?;
        class_key
            .set_value("", &format!("URL:{scheme} Protocol"))
            .map_err(|e| format!("设置协议标题失败（{scheme}）: {e}"))?;
        class_key
            .set_value("URL Protocol", &"")
            .map_err(|e| format!("设置 URL Protocol 失败（{scheme}）: {e}"))?;

        let (cmd_key, _) = hkcu
            .create_subkey(format!("{class_path}\\shell\\open\\command"))
            .map_err(|e| format!("创建命令键失败（{scheme}）: {e}"))?;
        cmd_key
            .set_value("", &command)
            .map_err(|e| format!("写入命令失败（{scheme}）: {e}"))?;
    }

    Ok(command)
}

#[cfg(windows)]
fn get_protocol_command_inner() -> Result<String, String> {
    use winreg::enums::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(cmd_key) = hkcu.open_subkey("Software\\Classes\\kiro\\shell\\open\\command") {
        let command: String = cmd_key.get_value("").unwrap_or_default();
        if !command.trim().is_empty() {
            return Ok(command);
        }
    }

    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    if let Ok(cmd_key) = hkcr.open_subkey("kiro\\shell\\open\\command") {
        let command: String = cmd_key.get_value("").unwrap_or_default();
        if !command.trim().is_empty() {
            return Ok(command);
        }
    }

    Err("鏈壘鍒?kiro 鍗忚鏄犲皠".to_string())
}

#[cfg(not(windows))]
fn get_protocol_command_inner() -> Result<String, String> {
    Err("褰撳墠骞冲彴涓嶆敮鎸?kiro 鍗忚鏄犲皠璁剧疆".to_string())
}

#[tauri::command]
pub async fn get_kiro_protocol_command() -> Result<String, String> {
    run_blocking_io(get_protocol_command_inner).await
}

#[tauri::command]
pub async fn set_kiro_protocol_executable(path: String) -> Result<String, String> {
    run_blocking_io(move || {
        #[cfg(windows)]
        {
            write_protocol_mapping(&path)
        }
        #[cfg(not(windows))]
        {
            let _ = path;
            Err("褰撳墠骞冲彴涓嶆敮鎸?kiro 鍗忚鏄犲皠璁剧疆".to_string())
        }
    })
    .await
}

#[tauri::command]
pub async fn reset_kiro_protocol_to_current_exe() -> Result<String, String> {
    run_blocking_io(|| {
        #[cfg(windows)]
        {
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("鏃犳硶鑾峰彇褰撳墠绋嬪簭璺緞: {e}"))?
                .display()
                .to_string();
            write_protocol_mapping(&exe_path)
        }
        #[cfg(not(windows))]
        {
            Err("褰撳墠骞冲彴涓嶆敮鎸?kiro 鍗忚鏄犲皠璁剧疆".to_string())
        }
    })
    .await
}

// ============================================================
// Deprecated account-machine binding commands kept as no-op for compatibility
// ============================================================

// ============================================================
// 浣跨敤閲忓巻鍙茶褰曞姛鑳?
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistoryEntry {
    pub date: String, // YYYY-MM-DD
    pub total_quota: i32,
    pub total_used: i32,
    pub account_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistory {
    pub entries: Vec<UsageHistoryEntry>,
}

fn get_usage_history_path() -> PathBuf {
    get_data_dir().join("usage-history.json")
}

fn get_usage_history_inner() -> Result<UsageHistory, String> {
    let path = get_usage_history_path();
    if !path.exists() {
        return Ok(UsageHistory::default());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("璇诲彇鍘嗗彶璁板綍澶辫触: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("瑙ｆ瀽鍘嗗彶璁板綍澶辫触: {e}"))
}

fn merge_usage_history_entry(history: &mut UsageHistory, entry: UsageHistoryEntry) {
    // If same-date record exists, update it; otherwise append a new entry
    if let Some(existing) = history.entries.iter_mut().find(|e| e.date == entry.date) {
        existing.total_quota = entry.total_quota;
        existing.total_used = entry.total_used;
        existing.account_count = entry.account_count;
    } else {
        history.entries.push(entry);
    }

    // 鍙繚鐣欐渶杩?30 澶╃殑璁板綍
    history.entries.sort_by(|a, b| a.date.cmp(&b.date));
    if history.entries.len() > 30 {
        let skip_count = history.entries.len() - 30;
        history.entries.drain(..skip_count);
    }
}

fn save_usage_history_entry_inner(entry: UsageHistoryEntry) -> Result<(), String> {
    let path = get_usage_history_path();
    ensure_parent_dir(&path)?;

    let mut history = get_usage_history_inner().unwrap_or_default();
    merge_usage_history_entry(&mut history, entry);

    let content = serde_json::to_string_pretty(&history).map_err(|e| format!("搴忓垪鍖栧け璐? {e}"))?;
    std::fs::write(&path, content).map_err(|e| format!("鍐欏叆澶辫触: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn get_usage_history() -> Result<UsageHistory, String> {
    run_blocking_io(get_usage_history_inner).await
}

#[tauri::command]
pub async fn save_usage_history_entry(entry: UsageHistoryEntry) -> Result<(), String> {
    run_blocking_io(move || save_usage_history_entry_inner(entry)).await
}




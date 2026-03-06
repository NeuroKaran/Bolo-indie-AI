use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if shortcut.matches(
                            tauri_plugin_global_shortcut::Modifiers::SUPER,
                            tauri_plugin_global_shortcut::Code::Space,
                        ) || format!("{}", shortcut).contains("Space")
                        {
                            log::info!("Global shortcut triggered: Ctrl+Space");
                            // Emit event to frontend
                            let _ = app.emit("toggle-recording", ());
                            // Show and focus the window
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Register global shortcut: Ctrl+Space
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            app.global_shortcut()
                .register("CmdOrCtrl+Space")
                .expect("Failed to register global shortcut Ctrl+Space");
            log::info!("Global shortcut Ctrl+Space registered");

            // Build system tray
            let show_item = MenuItem::with_id(app, "show", "Open Bolo", true, None::<&str>)?;
            let record_item =
                MenuItem::with_id(app, "record", "Record (Ctrl+Space)", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Bolo", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &record_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Bolo — Voice to Developer Prompts")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "record" => {
                        let _ = app.emit("toggle-recording", ());
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            log::info!("Bolo desktop app initialized");
            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray on close instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Bolo");
}

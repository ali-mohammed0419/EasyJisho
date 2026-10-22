#!/bin/bash
set -euo pipefail

action="${1:-}"
project_root="${2:-}"
configuration="${3:-Release}"

if [[ "$action" != "install" && "$action" != "uninstall" ]]; then
    echo "error: lifecycle action must be install or uninstall" >&2
    exit 64
fi

if [[ -z "$project_root" || ! -f "$project_root/Makefile" || ! -d "$project_root/JPTranslate.xcodeproj" ]]; then
    echo "error: invalid JPTranslate project root" >&2
    exit 64
fi

build_root="$project_root/build"
derived_products_root="$project_root/.build/DerivedData/Build/Products"
app_path="$build_root/JPTranslate.app"
extension_path="$app_path/Contents/PlugIns/JPTranslate Extension.appex"
extension_id="com.alimohammed.JPTranslate.Extension"
lsregister="/System/Library/Frameworks/CoreServices.framework/Versions/Current/Frameworks/LaunchServices.framework/Versions/Current/Support/lsregister"

is_safe_generated_path() {
    case "$1" in
        "$build_root"/*|"$derived_products_root"/*) return 0 ;;
        *) return 1 ;;
    esac
}

stop_host_app() {
    /usr/bin/pkill -x JPTranslate >/dev/null 2>&1 || true
    for _ in {1..25}; do
        if ! /usr/bin/pgrep -x JPTranslate >/dev/null 2>&1; then
            return
        fi
        sleep 0.2
    done

    echo "error: JPTranslate did not quit" >&2
    exit 1
}

unregister_extension_path() {
    local path="$1"
    if is_safe_generated_path "$path"; then
        /usr/bin/pluginkit -r "$path" >/dev/null 2>&1 || true
    fi
}

unregister_app_path() {
    local path="$1"
    if is_safe_generated_path "$path"; then
        "$lsregister" -u "$path" >/dev/null 2>&1 || true
    fi
}

clean_generated_products() {
    local preserve_canonical="${1:-0}"
    local registered_path
    while IFS= read -r registered_path; do
        [[ -n "$registered_path" ]] || continue
        if [[ "$preserve_canonical" -eq 1 && "$registered_path" == "$extension_path" ]]; then
            continue
        fi
        unregister_extension_path "$registered_path"
    done < <(
        /usr/bin/pluginkit -mAvvv -i "$extension_id" 2>/dev/null \
            | /usr/bin/sed -n 's/^[[:space:]]*Path = //p' || true
    )

    local search_root path
    for search_root in "$build_root" "$derived_products_root"; do
        [[ -d "$search_root" ]] || continue

        while IFS= read -r -d '' path; do
            if [[ "$preserve_canonical" -eq 1 && "$path" == "$extension_path" ]]; then
                continue
            fi
            unregister_extension_path "$path"
        done < <(/usr/bin/find "$search_root" -type d -name 'JPTranslate Extension.appex' -print0 2>/dev/null)

        while IFS= read -r -d '' path; do
            if [[ "$preserve_canonical" -eq 1 && "$path" == "$app_path" ]]; then
                continue
            fi
            unregister_app_path "$path"
        done < <(/usr/bin/find "$search_root" -type d -name 'JPTranslate.app' -print0 2>/dev/null)
    done

    for search_root in "$build_root" "$derived_products_root"; do
        [[ -d "$search_root" ]] || continue
        while IFS= read -r -d '' path; do
            if is_safe_generated_path "$path"; then
                /bin/rm -rf "$path"
            else
                echo "error: refusing to remove unsafe path: $path" >&2
                exit 1
            fi
        done < <(
            /usr/bin/find "$search_root" -depth -type d \
                \( -name 'JPTranslate.app' -o -name 'JPTranslate Extension.appex' \
                   -o -name 'JPTranslate.app.dSYM' -o -name 'JPTranslate Extension.appex.dSYM' \) \
                -print0 2>/dev/null \
                | while IFS= read -r -d '' path; do
                    if [[ "$preserve_canonical" -eq 1 \
                        && ( "$path" == "$app_path" || "$path" == "$extension_path" ) ]]; then
                        continue
                    fi
                    printf '%s\0' "$path"
                done
        )
    done

    /usr/bin/rmdir "$build_root" >/dev/null 2>&1 || true
}

canonical_extension_is_registered() {
    /usr/bin/pluginkit -mAvvv -i "$extension_id" 2>/dev/null \
        | /usr/bin/sed -n 's/^[[:space:]]*Path = //p' \
        | /usr/bin/grep -Fxq "$extension_path"
}

stop_host_app

if [[ "$action" == "uninstall" ]]; then
    clean_generated_products 0
    echo "Uninstalled all repository-local JPTranslate extension copies."
    echo "Safari was left running."
    exit 0
fi

clean_generated_products 1

/usr/bin/make -C "$project_root" --no-print-directory build CONFIGURATION="$configuration"

if [[ ! -d "$app_path" || ! -d "$extension_path" ]]; then
    echo "error: build completed without the expected app and extension bundles" >&2
    exit 1
fi

/usr/bin/open "$app_path"

for _ in {1..50}; do
    if canonical_extension_is_registered; then
        break
    fi
    sleep 0.2
done

if ! canonical_extension_is_registered; then
    /usr/bin/pluginkit -a "$extension_path"
fi

if ! canonical_extension_is_registered; then
    echo "error: Safari did not register the extension at $extension_path" >&2
    exit 1
fi

echo
echo "JPTranslate 1.0.1 was installed at $app_path."
echo "Safari was left running so Allow unsigned extensions remains enabled."
echo "If Safari retained an older worker, toggle JPTranslate off and on once"
echo "under Safari Settings > Extensions."

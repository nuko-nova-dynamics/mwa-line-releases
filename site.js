// The download page's links. Without this script every button opens the
// newest release on GitHub, which lists the files. With it, each button
// downloads its file directly, the sizes and version show, and the first
// button offers the file for the visitor's computer.
//
// Release file names carry the version (electron-builder's artifactName,
// mwa-line-<version>-<arch>.<ext>), so the newest names come from GitHub's
// public API rather than a fixed URL.

const RELEASES = "https://api.github.com/repos/nuko-nova-dynamics/mwa-line-releases/releases/latest"

/** Which release file each download is. */
const FILES = {
  "mac-arm": /-arm64\.dmg$/,
  "mac-intel": /-x64\.dmg$/,
  windows: /-x64\.exe$/,
  appimage: /\.AppImage$/,
  pacman: /\.pacman$/,
}

const LABELS = {
  "mac-arm": { label: "Download for Mac", meta: "Apple silicon" },
  "mac-intel": { label: "Download for Mac", meta: "Intel" },
  windows: { label: "Download for Windows", meta: "64-bit installer" },
  appimage: { label: "Download for Linux", meta: "AppImage" },
}

const megabytes = (bytes) => `${Math.round(bytes / 1_000_000)} MB`

const releasedOn = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

/** The visitor's computer, as one of FILES, or "phone", or null when unknown. */
async function detect() {
  const ua = navigator.userAgent
  const platform = navigator.userAgentData?.platform ?? ""
  if (/iPhone|iPad|iPod|Android/i.test(ua) || navigator.userAgentData?.mobile) return "phone"
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows"
  if (/mac/i.test(platform) || /Macintosh/i.test(ua)) {
    // Chromium browsers say which processor; Safari doesn't, and nearly
    // every Mac sold since 2021 is Apple silicon, so that's the default.
    try {
      const { architecture } = await navigator.userAgentData.getHighEntropyValues(["architecture"])
      if (architecture === "x86") return "mac-intel"
    } catch {
      // No client hints: keep the default.
    }
    return "mac-arm"
  }
  if (/Linux|X11/i.test(platform) || /Linux|X11/i.test(ua)) return "appimage"
  return null
}

async function release() {
  const response = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" } })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return response.json()
}

async function main() {
  const [computer, latest] = await Promise.all([detect(), release().catch(() => null)])

  const assets = {}
  if (latest) {
    for (const [key, pattern] of Object.entries(FILES)) {
      const asset = latest.assets.find((a) => pattern.test(a.name))
      if (asset) assets[key] = asset
    }
    for (const link of document.querySelectorAll("[data-file]")) {
      const asset = assets[link.dataset.file]
      if (asset) link.href = asset.browser_download_url
    }
    for (const cell of document.querySelectorAll("[data-size]")) {
      const asset = assets[cell.dataset.size]
      if (asset) cell.textContent = megabytes(asset.size)
    }
    const version = latest.tag_name.replace(/^v/, "")
    const line = document.querySelector("[data-version-line]")
    line.textContent = `Version ${version}, released ${releasedOn(latest.published_at)}. `
    const notes = document.createElement("a")
    notes.href = latest.html_url
    notes.textContent = "What's new"
    line.append(notes)
  }

  if (computer === "phone") {
    document.querySelector("[data-get]").hidden = true
    document.querySelector("[data-others]").hidden = true
    document.querySelector("[data-phone-note]").hidden = false
    return
  }

  const pick = LABELS[computer]
  if (!pick) return
  const primary = document.querySelector("[data-primary]")
  document.querySelector("[data-primary-label]").textContent = pick.label
  const asset = assets[computer]
  if (asset) primary.href = asset.browser_download_url
  const meta = [pick.meta]
  if (latest) meta.push(`version ${latest.tag_name.replace(/^v/, "")}`)
  if (asset) meta.push(megabytes(asset.size))
  document.querySelector("[data-primary-meta]").textContent = meta.join(", ") + "."

  const others = document.querySelector("[data-others]")
  if (computer === "mac-arm" || computer === "mac-intel") {
    const other = computer === "mac-arm" ? "mac-intel" : "mac-arm"
    others.textContent = ""
    const swap = document.createElement("a")
    swap.href = assets[other]?.browser_download_url ?? "#all"
    swap.textContent = other === "mac-intel" ? "Mac with Intel" : "Mac with Apple silicon"
    const all = document.createElement("a")
    all.href = "#all"
    all.textContent = "every download"
    others.append("Have a ", swap, "? Or see ", all, ".")
  }
  if (computer === "appimage") {
    others.textContent = ""
    const pacman = document.createElement("a")
    pacman.href = assets.pacman?.browser_download_url ?? "#all"
    pacman.textContent = "pacman package"
    const all = document.createElement("a")
    all.href = "#all"
    all.textContent = "every download"
    others.append("On Arch or Omarchy? Take the ", pacman, ". Or see ", all, ".")
  }
}

main()

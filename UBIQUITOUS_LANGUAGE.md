# Ubiquitous Language

## Display content

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Recipe** | A reusable screen template that knows how to render a specific kind of content. | Raw screen, component, plugin |
| **Named Screen** | A user-owned configured instance of a **Recipe**, with a name and saved parameter values. | Screen instance, configured recipe, saved recipe |
| **Renderable Reference** | A typed pointer to content that can be rendered for preview or device delivery. | Screen ref, content ref |
| **Screen Type** | The discriminator that says whether a reference points to a **Recipe**, **Named Screen**, or **Mixup**. | Kind, ref type |
| **Screen ID** | The identifier paired with a **Screen Type** to resolve renderable content. | Screen, recipe slug |
| **Content Assignment** | The selected content source currently assigned to a **Device**, playlist frame, or mixup slot. | Selection, screen choice |

## Devices and delivery

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Device** | A physical TRMNL-compatible display registered in BYOS. | Tablet, display, hardware |
| **API Key** | The device credential used to authorize display and bitmap requests. | Access token, token |
| **Friendly ID** | The short user-facing identifier used in device URLs and UI labels. | Device code, short ID |
| **Display Request** | A device request asking BYOS which image URL it should fetch next. | Refresh call, screen fetch |
| **Display Mode** | The device-level mode that determines whether a device renders one screen, a playlist, or a mixup. | Mode |
| **Current Display** | The content BYOS says a device should render at a given refresh. | Latest screen, active screen |

## Rotation and composition

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Playlist** | An ordered rotation of frames assigned to a device. | Reel, rotation |
| **Playlist Frame** | One timed item in a **Playlist**, pointing to a recipe, named screen, or mixup. | Playlist item, screen |
| **Frame Duration** | The number of seconds a **Playlist Frame** should stay active. | Duration |
| **Mixup** | A split-screen composition containing multiple slots rendered into one image. | Layout, collage |
| **Mixup Slot** | One region inside a **Mixup** that references a recipe or named screen. | Slot, panel |
| **Layout** | The geometric arrangement of slots within a **Mixup**. | Template |

## Rendering and preview

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Preview** | A UI-rendered representation of content before or aside from device delivery. | Latest screen, mock |
| **Preview Format** | The output representation selected in preview controls: React, PNG, or BMP. | Format |
| **React Preview** | A direct browser rendering of recipe UI before image conversion. | Direct preview |
| **PNG Render** | A raster image output before bitmap conversion. | PNG preview |
| **BMP Render** | The final bitmap-style output used by devices. | Bitmap, image |
| **Resolution** | The width and height requested for PNG or BMP rendering. | Size, device preset |
| **Orientation** | The landscape or portrait interpretation of the selected resolution. | Rotation |
| **Grayscale Level** | The number of gray levels used when converting to BMP. | BPP, palette |
| **Palette** | A named set of colors or grayscale values associated with a device profile or preview. | Grayscale, color mode |
| **Render Pipeline** | The sequence from source content to React, PNG, and optionally BMP output. | Pipeline, render path |

## Ownership and configuration

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **User Scope** | The ownership boundary that limits which devices, screens, playlists, and mixups are visible. | Tenant, account |
| **Screen Params** | The saved parameter values applied when rendering a recipe or named screen. | Props, settings |
| **Recipe Defaults** | The default parameter values supplied by a recipe when no saved override exists. | Default props |
| **Device Profile** | The derived rendering characteristics for a device model, including size and palette support. | Model config |

## Relationships

- A **Recipe** can have many **Named Screens**.
- A **Named Screen** belongs to exactly one **User Scope** and exactly one **Recipe**.
- A **Device** has one active **Display Mode**.
- A **Device** can point to one **Named Screen**, one **Recipe**, one **Playlist**, or one **Mixup**, depending on its **Display Mode**.
- A **Playlist** has many **Playlist Frames**.
- A **Playlist Frame** has one **Renderable Reference**.
- A **Mixup** has many **Mixup Slots**.
- A **Mixup Slot** has one **Renderable Reference**.
- A **Display Request** resolves the device's **Content Assignment** into an image URL.
- A **BMP Render** is produced from a **PNG Render** using the selected **Grayscale Level**.
- A **React Preview** uses **Orientation** but does not use **Resolution** or **Grayscale Level** controls.
- A **PNG Render** uses **Orientation** and **Resolution** but does not use **Grayscale Level** controls.
- A **BMP Render** uses **Orientation**, **Resolution**, and **Grayscale Level** controls.

## Example dialogue

> **Dev:** "When the user picks a **Recipe** in the device editor, do we assign the recipe directly?"
> **Domain expert:** "No. If they want saved configuration, create a **Named Screen** from that **Recipe** and assign the device to the named screen."
> **Dev:** "So the device stores a **Screen Type** of `screen` and a **Screen ID** containing the named screen UUID?"
> **Domain expert:** "Exactly. A legacy recipe slug is still a **Renderable Reference**, but new configured content should be a **Named Screen**."
> **Dev:** "And in preview, **React Preview** only needs orientation, while **BMP Render** also needs resolution and grayscale?"
> **Domain expert:** "Yes. The controls should match the selected **Preview Format**, and the **Render Pipeline** summary belongs below the preview."

## Flagged ambiguities

- "screen" has been used for both **Recipe** slugs and **Named Screen** UUIDs; use **Recipe** for reusable templates and **Named Screen** for configured user-owned instances.
- `device.screen` is a legacy field; prefer **Screen Type** + **Screen ID** when discussing new content assignments.
- "preview" has been used for dashboard latest screen, device preview, recipe preview, playlist preview, and mixup preview; use **Preview** generically and qualify it by context when needed.
- "palette", "grayscale", and "bpp" were mixed in UI copy; use **Grayscale Level** for BMP conversion controls and **Palette** only for named device/color palettes.
- "playlist item", "frame", and "screen" were used interchangeably; use **Playlist Frame** for one timed item in a playlist.
- "mixup layout" and "mixup" were sometimes conflated; use **Mixup** for the composed content and **Layout** for slot geometry.

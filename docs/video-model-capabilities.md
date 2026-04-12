# Video Model Capability Notes

This file records the video capability contract used by the canvas video node.
Keep two layers separate:

- `LOCAL_VIDEO_CAPABILITIES` means the current app can route the feature.
- `NATIVE_VIDEO_CAPABILITY_OVERRIDES` means the provider advertises the feature, even if the app has not wired it yet.

## Current Main Path

| Model | Text | Single image to video | Reference images | First/last frame | Duration | Ratio | Resolution | Current execution notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `veo3.1` | Yes | Yes | Yes, up to 3 asset refs | Yes | 4 / 6 / 8s | 16:9 / 9:16 | 512p / 720p / 1080p | Local Gemini route uses `image` for normal I2V, `config.referenceImages` for full/reference images, and `config.lastFrame` for end-frame interpolation. |
| `kling-v2-6` | Yes | Yes | No standard multi-ref route | Yes | 5 / 10s | 1:1 / 16:9 / 9:16 standard, 16:9 / 9:16 frame mode | Auto | Standard T2V/I2V routes through FAL; frame-to-frame and motion control use their dedicated routes. |
| `kling-v3` | Yes | Yes | Not wired in standard route | Yes | 5 / 10s | 16:9 / 9:16 | Auto / 720p / 1080p | Native docs advertise broader reference features; app keeps standard backend narrow until provider route is wired. |
| `minimax-hailuo` | Yes | Yes | Yes | Yes | 6 / 10s | 16:9 / 9:16 | 768p / 1080p | Single image remains normal I2V; multiple connected images use Hailuo subject/reference route. |
| `wan2.6-i2v` | No | Yes | No | No | 5 / 10 / 15s | Auto | 720p / 1080p | I2V-only model through FAL Wan. |
| `wan2.6-i2v-flash` | No | Yes | No | No | 5 / 10 / 15s | Auto | 720p / 1080p | Fast I2V-only Wan route. |
| `jimeng-seedance-2` | Yes | Yes | Not wired in standard route | Yes | 5 / 10s | 16:9 / 9:16 | 720p / 1080p | Seedance standard and first/last frame are routed; multi-reference remains native-only until wired. |
| `jimeng-4.5` | Yes | Yes | Not wired in standard route | Yes | 5 / 10s | 16:9 / 9:16 | 720p / 1080p | Seedance standard and first/last frame are routed. |
| `jimeng-4.1` | Yes | Yes | No | No | 5 / 10s | 16:9 / 9:16 | 720p / 1080p | Standard route only. |
| `jimeng-4.0` | Yes | Yes | Native only | No local frame route | 5 / 10s | 16:9 / 9:16 | 720p / 1080p | Public docs indicate multi-reference in the family, but current route stays standard-only. |
| `jimeng-video-3-fast` | Yes | Yes | No | No | 5 / 10s | 16:9 / 9:16 | 720p / 1080p | Standard route only. |
| `sora-2` | Yes | Yes | Native only | No | 4 / 8 / 12s | 16:9 / 9:16 | 720p / 1080p | Current app routes standard T2V/I2V only. |
| `grok-video-3` | Yes | Yes | No | No | 4 / 8 / 10 / 12 / 15s | 1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3 | 480p / 720p | Standard T2V/I2V only. |

## Source Pointers

- Google Veo: `https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate-preview`
- Google GenAI SDK types: `node_modules/@google/genai/dist/node/node.d.ts`
- MiniMax Hailuo: `https://platform.minimax.io/docs/guides/video-generation`
- Kling releases: `https://ir.kuaishou.com/`
- BytePlus Seedance: `https://docs.byteplus.com/en/docs/ModelArk/1587798`
- Aliyun Wan I2V: `https://help.aliyun.com/zh/model-studio/image-to-video-guide`
- OpenAI Sora: `https://developers.openai.com/api/docs/models/sora-2`

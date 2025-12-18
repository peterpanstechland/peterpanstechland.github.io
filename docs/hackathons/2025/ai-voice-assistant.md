---
sidebar_position: 2
title: AI Voice Assistant Hackathon
description: Building a voice-controlled IoT system using Amazon Bedrock and ESP32
keywords: [hackathon, ai, voice, bedrock, esp32, iot]
---

# 🎤 AI Voice Assistant Hackathon 2025

> Building an edge-to-cloud voice assistant using Amazon Bedrock Nova and ESP32.

## 📋 Event Info

| Field | Details |
|-------|---------|
| **Event** | AI Innovation Hackathon |
| **Date** | June 2025 |
| **Duration** | 48 hours |
| **Team Size** | 3 members |
| **Result** | 🏅 Finalist |

---

## 🎯 Project: EdgeVoice

An intelligent voice assistant that runs partially on edge devices (ESP32) and leverages Amazon Bedrock Nova for natural language understanding.

### Key Features

- 🎙️ **Wake Word Detection** - On-device "Hey Nova" detection
- 🔊 **Voice Activity Detection** - Edge-based VAD for efficient streaming
- 🧠 **LLM Processing** - Amazon Bedrock Nova for responses
- 🏠 **Smart Home Control** - Voice-controlled IoT devices
- ⚡ **Low Latency** - < 500ms end-to-end response time

---

## 🏗️ Architecture

```
┌──────────────────┐     MQTT/WebSocket     ┌──────────────────┐
│                  │ ───────────────────▶   │                  │
│   ESP32-S3       │                        │   AWS IoT Core   │
│   + Microphone   │ ◀───────────────────   │                  │
│                  │     Audio Stream       │                  │
└──────────────────┘                        └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │     Lambda       │
                                            │  (Orchestrator)  │
                                            └────────┬─────────┘
                                                     │
                              ┌───────────────────────┼───────────────────────┐
                              ▼                       ▼                       ▼
                    ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
                    │  Bedrock Nova    │   │    Polly TTS     │   │   IoT Shadow     │
                    │   (LLM/NLU)      │   │  (Text-to-Speech)│   │  (Device State)  │
                    └──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## 🛠️ Tech Stack

### Edge (ESP32-S3)
- **Hardware:** ESP32-S3 DevKit + INMP441 Microphone
- **Firmware:** ESP-IDF with FreeRTOS
- **Audio:** Opus Codec, 16kHz sampling
- **Connectivity:** WiFi + MQTT

### Cloud (AWS)
- **IoT:** AWS IoT Core, Device Shadow
- **AI:** Amazon Bedrock (Nova Micro)
- **Audio:** Amazon Polly, Transcribe
- **Compute:** Lambda (Python)
- **IaC:** AWS SAM

---

## 💻 Key Code Snippets

### ESP32 Wake Word Detection

```cpp
// Simplified wake word detection
void audio_task(void *pvParameters) {
    while (1) {
        int16_t samples[SAMPLE_SIZE];
        i2s_read(I2S_NUM_0, samples, sizeof(samples), &bytes_read, portMAX_DELAY);
        
        // Run wake word model
        if (detect_wake_word(samples, SAMPLE_SIZE)) {
            ESP_LOGI(TAG, "Wake word detected!");
            start_voice_stream();
        }
    }
}
```

### Lambda - Bedrock Integration

```python
import boto3
import json

bedrock = boto3.client('bedrock-runtime')

def invoke_nova(transcript: str, context: dict) -> str:
    """Call Bedrock Nova for response generation."""
    
    system_prompt = """You are a helpful smart home assistant. 
    You can control lights, thermostats, and other IoT devices.
    Keep responses concise and action-oriented."""
    
    response = bedrock.converse(
        modelId='amazon.nova-micro-v1:0',
        messages=[
            {'role': 'user', 'content': [{'text': transcript}]}
        ],
        system=[{'text': system_prompt}],
        inferenceConfig={
            'maxTokens': 200,
            'temperature': 0.7,
        }
    )
    
    return response['output']['message']['content'][0]['text']
```

### IoT Device Control

```python
def control_device(intent: str, device_id: str, params: dict):
    """Update IoT Device Shadow based on voice command."""
    
    iot = boto3.client('iot-data')
    
    shadow_update = {
        'state': {
            'desired': params
        }
    }
    
    iot.update_thing_shadow(
        thingName=device_id,
        payload=json.dumps(shadow_update)
    )
```

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Wake Word Accuracy | 94% |
| Speech-to-Text Accuracy | 97% |
| End-to-End Latency | 450ms |
| Power Consumption | 180mA active |
| Cost per 1000 queries | $0.12 |

---

## 🎥 Demo Video

<iframe width="560" height="315" src="https://www.youtube.com/embed/demo-video-id" frameborder="0" allowfullscreen></iframe>

*Demo video showing voice-controlled smart home interactions*

---

## 📝 Lessons Learned

1. **Edge preprocessing is crucial** - VAD and wake word detection save cloud costs
2. **Opus codec rocks** - Great quality at low bitrate for streaming
3. **Bedrock Nova is fast** - Sub-100ms inference times
4. **IoT Core handles scale** - MQTT is perfect for real-time audio

---

## 🔗 Resources

- [GitHub Repository](https://github.com/peterpanstechland/edgevoice)
- [Hardware BOM](https://github.com/peterpanstechland/edgevoice/blob/main/hardware/BOM.md)
- [Firmware Setup Guide](/docs/guides/edge/esp32-intro)

---

## 🏆 Awards & Recognition

- 🏅 **Finalist** - Top 10 out of 150 teams
- 🎨 **Best Demo** - Most engaging live demonstration
- ⚡ **Technical Innovation** - Edge AI implementation


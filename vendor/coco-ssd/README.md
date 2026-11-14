# On-device bike detector

Used by `js/vision.js` to recognise a bicycle in real end-of-ride photos. Nothing is sent to a server.

| File | Source | License |
|---|---|---|
| `../tfjs/tf.min.js` | npm `@tensorflow/tfjs@4.22.0` (`dist/tf.min.js`) | Apache 2.0 |
| `coco-ssd.min.js` | npm `@tensorflow-models/coco-ssd@2.2.3` (`dist/coco-ssd.min.js`) | Apache 2.0 |
| `model/` | `https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/` (`model.json` + 5 weight shards) | Apache 2.0 |

The weight shards were renamed to `*.bin` (and `model.json` updated to match) so every static host serves them with a normal file type.

The model is pretrained on the COCO dataset (80 object classes, including `bicycle`). Gari only reads the `bicycle` class with a score of 0.5 or more.

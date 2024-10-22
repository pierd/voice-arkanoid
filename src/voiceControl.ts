export class VoiceControl {
  private context: AudioContext;
  private analyzerNode: AnalyserNode;
  private microphone;
  private dataArray: Uint8Array;

  constructor(
    context: AudioContext,
    analyzerNode: AnalyserNode,
    microphone: MediaStreamAudioSourceNode
  ) {
    this.context = context;
    this.analyzerNode = analyzerNode;
    this.microphone = microphone;
    this.dataArray = new Uint8Array(this.analyzerNode.frequencyBinCount);
  }

  public get frequencyPerDataPoint() {
    return this.context.sampleRate / this.analyzerNode.fftSize;
  }

  public dispose() {
    this.microphone.disconnect();
    this.context.close();
  }

  public prepareByteFrequencyArray(): Uint8Array {
    return new Uint8Array(this.analyzerNode.frequencyBinCount);
  }

  public getByteFrequencyData(array: Uint8Array) {
    this.analyzerNode.getByteFrequencyData(array);
  }

  public getMaxAmplitudeFreq(minFreq: number | null, maxFreq: number | null) {
    this.getByteFrequencyData(this.dataArray);

    let maxAmplitude = 0;
    let maxFrequency = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const frequency =
        (i * this.analyzerNode.context.sampleRate) / this.analyzerNode.fftSize;
      if (
        (minFreq === null || frequency >= minFreq) &&
        (maxFreq === null || frequency <= maxFreq) &&
        this.dataArray[i] > maxAmplitude
      ) {
        maxAmplitude = this.dataArray[i];
        maxFrequency = frequency;
      }
    }
    return { frequency: maxFrequency, amplitude: maxAmplitude };
  }

  public static async create() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new window.AudioContext();
      const analyzerNode = context.createAnalyser();
      const microphone = context.createMediaStreamSource(stream);
      microphone.connect(analyzerNode);
      analyzerNode.fftSize = 2048;
      return new VoiceControl(context, analyzerNode, microphone);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }
}

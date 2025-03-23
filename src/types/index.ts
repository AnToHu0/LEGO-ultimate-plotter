export interface Config {
  defaultResolution: number
  orientation: 'h' | 'v'
  scale: number
  offset: {
    x: number
    y: number
  },
  img: null | HTMLImageElement,
  imgData: null | ImageData,
  mode: "cmyk" | "black",
  algo: string | null
}

type CommonWorkerOption = {
  label: string
  noRestart?: boolean
};

type CheckboxWorkerOption = CommonWorkerOption & {
  type: 'checkbox'
  checked?: boolean
}

type SelectWorkerOption = CommonWorkerOption & {
  type: 'select'
  value: string
  options: string[]
}

type RangeWorkerOption = CommonWorkerOption & {
  type?: 'range'
  value: number
  min: number
  max: number
  step?: number
}

export type WorkerOption = CheckboxWorkerOption | RangeWorkerOption | SelectWorkerOption;

export type SourceTabs = 'image' | 'text' | 'webcam'

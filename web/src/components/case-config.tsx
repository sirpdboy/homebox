import { useState, useRef, useMemo } from 'react'
import { NumericInput, FormGroup, RadioGroup, Radio, Slider, Button, ButtonGroup, Collapse } from '@blueprintjs/core'
import { RunningMode, SpeedMode, Config, RateUnit } from '../types' // 移除了 Theme 导入
import { css } from '@emotion/react'
import { Var, ThemeVar } from '../styles/variable'
import styled from '@emotion/styled'
import { $valm } from '../styles/utils'
import { useLanguage } from '../contexts/LanguageContext' // 添加语言钩子导入

const $Header = styled.div`
  display: flex;
  flex-direction: row;
  margin-bottom: 24px;
  align-items: center;
`

const $HeaderLeft = styled.div`
  flex: auto;
`

const $HeaderRight = styled.div`
  flex: none;
  display: flex;
  gap: 8px;
`

const $mgr8 = css`
  margin-right: 8px;
`

type ChangeHandler<T> = (newValue: T, oldValue: T) => void
type ChangeHandlerDispose = () => void

interface FormFieldBase<T> {
  readonly value: T
  readonly initial: T
  readonly touched: boolean
  readonly error: any
  onChange(v: T): void
  whenChanged(handler: ChangeHandler<T>): ChangeHandlerDispose
  validate(): any
}

interface FormField<T> extends FormFieldBase<T> {
  type: 'field'
}

interface FormObjectGroup<T extends FormFields> extends FormFieldBase<FormFieldsValue<T>> {
  type: 'object'
  fields: T
}

interface FormArrayGroup<T> extends FormFieldBase<T> {
  type: 'array'
  fields: FormField<T>[]
}

type FormFields = Record<string | number, FormFieldBase<any>>

type FormFieldsValue<F extends FormFields> = {
  [K in keyof F]: F[K] extends FormFieldBase<infer T> ? T : never
}

interface Form<F extends FormFields> {
  fields: F
  values: FormFieldsValue<F>
}

interface FormFieldConfig<T> {
  changeTransform?(from: any): T
  passTransform?(value: T): any
  validate?(value: T): any
}

function getValuesFromFields<T extends FormFields = FormFields>(fields: T): FormFieldsValue<T> {
  return Object.entries(fields).reduce((values, [key, field]) => {
    values[key as any] = field.value
    return values
  }, {} as FormFieldsValue<T>)
}

function createForm<F extends FormFields>(fields: F): Form<F> {
  let cacheValues = getValuesFromFields(fields)
  let dirtyValues = false

  const fieldsArray = Object.values(fields)

  for (const field of fieldsArray) {
    field.whenChanged(() => {
      dirtyValues = true
    })
  }

  return {
    fields,
    get values() {
      if (dirtyValues) {
        cacheValues = getValuesFromFields(fields)
        dirtyValues = false
      }
      return cacheValues as FormFieldsValue<F>
    },
  }
}

function createFormField<T>(initial: T, config: FormFieldConfig<T> = {}): FormField<T> {
  let value = initial
  let error: any = null
  let touched = false
  const changeHandlers: ChangeHandler<T>[] = []

  function triggerChanged(nv: T, ov: T) {
    for (const handler of changeHandlers) {
      handler(nv, ov)
    }
  }

  return {
    type: 'field',
    get value() {
      return value
    },
    get initial() {
      return initial
    },
    get error() {
      return error
    },
    get touched() {
      return touched
    },
    onChange(nv) {
      if (value !== nv) {
        const ov = value
        value = nv
        triggerChanged(nv, ov)
        touched = true
      }
    },
    whenChanged(handler) {
      changeHandlers.push(handler)
      return () => {
        changeHandlers.splice(changeHandlers.indexOf(handler), 1)
      }
    },
    validate() {
      if (!config.validate) {
        error = null
        return
      }

      const ret = config.validate(value)
      if (!ret || !ret.then) {
        error = null
        return ret
      }

      return ret
        .then((newRet: any) => {
          if (newRet) {
            error = newRet
          }
          error = null
        })
        .catch((e: any) => {
          error = e
        })
    },
  }
}

function createFormObjectGroup<T extends FormFields>(fields: T, config: FormFieldConfig<T> = {}): FormObjectGroup<T> {
  type V = FormFieldsValue<T>
  const initial = getValuesFromFields<T>(fields)
  let cacheValues = initial
  let dirtyValues = false
  let touched = false
  const error: any = null
  const handlers: ChangeHandler<V>[] = []

  const fieldsArray = Object.values(fields)

  function updateValue() {
    if (dirtyValues) {
      cacheValues = getValuesFromFields<T>(fields)
      dirtyValues = false
    }
    return cacheValues
  }

  for (const field of fieldsArray) {
    field.whenChanged(() => {
      dirtyValues = true
      touched = true
      const ov = cacheValues
      const nv = updateValue()
      triggerChanged(nv, ov)
    })
  }

  function triggerChanged(nv: V, ov: V) {
    for (const handler of handlers) {
      handler(nv, ov)
    }
  }

  return {
    type: 'object',
    fields,
    initial,
    get error() {
      return error
    },
    get value() {
      return updateValue()
    },
    get touched() {
      return touched
    },
    onChange(v) {
      let hasChanged = false
      for (const [key, value] of Object.entries(v)) {
        if (cacheValues[key] !== v[key] && fields[key]) {
          hasChanged = true
          fields[key].onChange(value)
        }
      }
      if (!hasChanged) {
        return
      }
      const ov = cacheValues
      const nv = updateValue()
      triggerChanged(nv, ov)
    },
    whenChanged(handler) {
      handlers.push(handler)
      return () => {
        handlers.splice(handlers.indexOf(handler), 1)
      }
    },
    validate() {
      // TODO
    },
  }
}

export function CaseConfig(props: { defaultValue?: Config; onChange?: (v: Config) => void }) {
  const [_, setCount] = useState(0)
  const onChangeRef = useRef(props.onChange)
  onChangeRef.current = props.onChange
  
  const { language, setLanguage, t } = useLanguage()
  
  const form = useMemo(() => {
    const { defaultValue } = props
    const group = createFormObjectGroup({
      runningMode: createFormField(defaultValue?.duration !== Infinity ? RunningMode.ONCE : RunningMode.CONTINUE, {}),
      threadCount: createFormField(defaultValue?.threadCount ?? 1, {}),
      speedRange: createFormField(defaultValue?.speedMode ?? SpeedMode.LOW, {}),
      packCount: createFormField(defaultValue?.packCount ?? 64, {}),
      parallel: createFormField(defaultValue?.parallel ?? 3, {}),
      unit: createFormField(defaultValue?.unit ?? RateUnit.BYTE),
      duration: createFormField(
        defaultValue?.duration === Infinity ? 10 : (defaultValue?.duration ?? 10 * 1000) / 1000,
      ),
    })

    group.whenChanged((nv, ov) => {
      if (nv.speedRange !== ov.speedRange) {
        if (nv.speedRange === SpeedMode.HIGH) {
          let concurrency = navigator.hardwareConcurrency ?? 4
          if (concurrency > 1) {
            concurrency -= 1
          }
          group.fields.threadCount.onChange(concurrency)
        } else {
          group.fields.threadCount.onChange(1)
        }
        return
      }
      setCount((v) => v + 1)
      if (onChangeRef.current) {
        onChangeRef.current({
          threadCount: nv.threadCount,
          speedMode: nv.speedRange,
          packCount: nv.packCount,
          parallel: nv.parallel,
          unit: nv.unit,
          duration: nv.runningMode === RunningMode.ONCE ? nv.duration * 1000 : Infinity,
          // 移除了 theme
        })
      }
    })
    return group
  }, [])
  
  const [isAdvancedConfig, setAdvancedConfig] = useState(false)

  const { runningMode, threadCount, speedRange, packCount, duration, unit, parallel } = form.fields

  return (
    <div>
      <$Header>
        <$HeaderLeft>
          <ButtonGroup css={css`${$mgr8}${$valm}`}>
            <Button
              intent={runningMode.value === RunningMode.ONCE ? 'success' : 'none'}
              onClick={() => runningMode.onChange(RunningMode.ONCE)}
              icon={runningMode.value === RunningMode.ONCE ? 'small-tick' : undefined}
            >
              {t('singleTest')}
            </Button>
            <Button
              intent={runningMode.value === RunningMode.CONTINUE ? 'success' : 'none'}
              onClick={() => runningMode.onChange(RunningMode.CONTINUE)}
              icon={runningMode.value === RunningMode.CONTINUE ? 'small-tick' : undefined}
            >
              {t('continuousTest')}
            </Button>
          </ButtonGroup>
          
          <ButtonGroup css={css`${$mgr8}${$valm}`}>
            <Button
              title={t('bytePerSecond')}
              intent={unit.value === RateUnit.BYTE ? 'success' : 'none'}
              onClick={() => unit.onChange(RateUnit.BYTE)}
              icon={unit.value === RateUnit.BYTE ? 'small-tick' : undefined}
            >
              B/s
            </Button>
            <Button
              title={t('bitPerSecond')}
              intent={unit.value === RateUnit.BIT ? 'success' : 'none'}
              onClick={() => unit.onChange(RateUnit.BIT)}
              icon={unit.value === RateUnit.BIT ? 'small-tick' : undefined}
            >
              b/s
            </Button>
          </ButtonGroup>
          
          <ButtonGroup css={$valm}>
            <Button
              onClick={() => setAdvancedConfig(!isAdvancedConfig)}
              intent={isAdvancedConfig ? 'success' : 'none'}
              icon='settings'
            >
              {isAdvancedConfig ? t('normalConfig') : t('advancedConfig')}
            </Button>
          </ButtonGroup>
        </$HeaderLeft>
        
        <$HeaderRight>
          {/* 添加语言切换按钮 */}
          <Button
            intent='none'
            icon='translate'
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            minimal
          >
            {language === 'en' ? '中文' : 'English'}
          </Button>
        </$HeaderRight>
      </$Header>

      <Collapse isOpen={isAdvancedConfig}>
        <div
          css={css`
            padding: 24px;
            background: ${Var(ThemeVar.ConfigPanelBgColor)};
            margin-bottom: 24px;
          `}
        >
          {runningMode.value === RunningMode.ONCE && (
            <FormGroup 
              label={t('duration')} 
              labelInfo={`(${t('seconds')})`} 
              key='duration' 
              inline={true}
            >
              <NumericInput value={duration.value} onValueChange={duration.onChange} />
            </FormGroup>
          )}
          
          <FormGroup
            label={t('speedRange')}
            key='speedRange'
            inline={true}
            helperText={t('speedRangeHelper')}
          >
            <RadioGroup
              selectedValue={speedRange.value}
              onChange={(e) => speedRange.onChange(e.currentTarget.value as SpeedMode)}
              inline={true}
            >
              <Radio label={t('lowSpeed')} value={SpeedMode.LOW} />
              <Radio label={t('highSpeed')} value={SpeedMode.HIGH} />
            </RadioGroup>
          </FormGroup>

          {speedRange.value === SpeedMode.HIGH && (
            <FormGroup
              label={t('threadCount')}
              key='threadCount'
              helperText={t('threadCountHelper')}
            >
              <Slider 
                min={1} 
                max={8} 
                value={threadCount.value} 
                onChange={threadCount.onChange} 
                labelRenderer={(v) => `${v}`}
              />
            </FormGroup>
          )}
          
          <FormGroup 
            label={t('packCount')} 
            key='packCount' 
            helperText={t('packCountHelper')}
          >
            <Slider
              min={8}
              max={256}
              stepSize={8}
              labelStepSize={32}
              labelRenderer={(v) => `${v}M`}
              value={packCount.value}
              onChange={(v) => packCount.onChange(v)}
            />
          </FormGroup>
          
          <FormGroup 
            label={t('parallel')} 
            helperText={t('parallelHelper')}
          >
            <Slider
              min={1}
              max={16}
              stepSize={1}
              labelStepSize={4}
              value={parallel.value}
              onChange={parallel.onChange}
              labelRenderer={(v) => `${v}`}
            />
          </FormGroup>
        </div>
      </Collapse>
    </div>
  )
}

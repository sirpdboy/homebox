import { SpeedIndicator } from './speed-indicator'
import styled from '@emotion/styled'
import { useState, useContext } from 'react'
import { useRates } from '../hooks'
import { ChannelsContext, ConfigContext } from '../context'
import { zip, interval } from 'rxjs'
import { rateFormatters } from '../utils'
import { Button, Intent } from '@blueprintjs/core'
import { $textCenter, $mgt } from '../styles/utils'
import { css } from '@emotion/react'
import { take, mergeMap } from 'rxjs/operators'
import { ping } from '../cases/ping'
import { showToast } from '../toaster'
import { useLanguage } from '../contexts/LanguageContext'

const API_BASE_URL = ''; 

const $Header = styled.div`
  display: flex;
`

const $HeaderCase = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  text-align: center;
`

const $CaseTitle = styled.div``
const $CaseContent = styled.div`
  font-size: 24px;
  font-weight: bold;
`

enum RunningStep {
  NONE = 1,
  PING,
  DOWNLOAD,
  UPLOAD,
  DONE,
}

export function RunCaseOnce() {
  const [dlRate, setDlRate] = useState(-1)
  const [ulRate, setUlRate] = useState(-1)
  const [ttl, pushTTL, clearTTL] = useRates(5)
  const [step, setStep] = useState(RunningStep.NONE)
  const createChannels = useContext(ChannelsContext)
  const { duration, parallel, packCount, unit } = useContext(ConfigContext)
  const { t } = useLanguage()

  const getStepLabel = (step: RunningStep): string => {
    const stepLabels: Record<RunningStep, string> = {
      [RunningStep.NONE]: t('start'),
      [RunningStep.PING]: t('pinging'),
      [RunningStep.DOWNLOAD]: t('downloading'),
      [RunningStep.UPLOAD]: t('uploading'),
      [RunningStep.DONE]: t('restart'),
    }
    return stepLabels[step]
  }

  const _start = async () => {
    clearTTL()
    setStep(RunningStep.PING)
    
    await interval(500)
      .pipe(
        take(10),
        mergeMap(() => ping()),
      )
      .forEach((v) => {
        pushTTL(v)
      })
    
    const channels = await createChannels()

    setStep(RunningStep.DOWNLOAD)
    await zip(
      ...channels.map((channel) =>
        channel.observe('download', {
          duration,
          packCount,
          parallel,
          interval: 500,
        }),
      ),
    ).forEach((v) => {
      setDlRate(v.reduce((a, b) => a + b, 0))
    })

    setStep(RunningStep.UPLOAD)

    await zip(
      ...channels.map((channel) =>
        channel.observe('upload', {
          duration,
          packCount,
          parallel,
          interval: 500,
        }),
      ),
    ).forEach((v) => {
      setUlRate(v.reduce((a, b) => a + b, 0))
    })

    setStep(RunningStep.DONE)
  }

const start = () => {
  setDlRate(-1);
  setUlRate(-1);
  clearTTL();
  setStep(RunningStep.NONE);
  
  setTimeout(() => {
    _start().catch(err => {
      showToast({
        message: t('errorMessage'),
        intent: Intent.DANGER,
        icon: "warning-sign",
      });
      setStep(RunningStep.NONE); 
    });
  }, 50);
};


  return (
    <div>
      <$Header>
        <$HeaderCase>
          <$CaseTitle>{t('ping')}</$CaseTitle>
          <$CaseContent>{step >= RunningStep.PING ? `${ttl.toFixed(2)} ms` : '--'}</$CaseContent>
        </$HeaderCase>

        <$HeaderCase>
          <$CaseTitle>{t('download')}</$CaseTitle>
          <$CaseContent>{step >= RunningStep.DOWNLOAD ? rateFormatters[unit](dlRate) : '--'}</$CaseContent>
        </$HeaderCase>

        <$HeaderCase>
          <$CaseTitle>{t('upload')}</$CaseTitle>
          <$CaseContent>{step >= RunningStep.UPLOAD ? rateFormatters[unit](ulRate) : '--'}</$CaseContent>
        </$HeaderCase>
      </$Header>
      <SpeedIndicator
        speed={step === RunningStep.DOWNLOAD ? dlRate : step === RunningStep.UPLOAD ? ulRate : undefined}
        running={step !== RunningStep.DONE && step !== RunningStep.NONE}
      />
      <div css={css`${$textCenter}${$mgt[4]}`}>
        <Button onClick={start} disabled={step !== RunningStep.NONE && step !== RunningStep.DONE}>
          {getStepLabel(step)}
        </Button>
      </div>
    </div>
  )
}
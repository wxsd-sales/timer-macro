/********************************************************
 * 
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-0
 * Released: 08/20/24
 * 
 * This is an example timer macro for RoomOS Devices
 *
 * Full Readme, source code and license agreement available on Github:
 * https://github.com/wxsd-sales/timer-macro/
 * 
 ********************************************************/

import xapi from 'xapi';

/*********************************************************
 * Configure the settings below
**********************************************************/

const config = {
  presets: {
    seconds: [15, 20, 30, 45],
    minutes: [1, 5, 10, 15],
    minutesSeconds: ['1:20', '1:50', '2:40', '5:00']
  },
  defaultTime: 600,
  localisation: {
    buttonText: 'Timer',
    presetsButton: 'Presets',
    presetsTitle: 'Select Preset',
    locationTitle: 'Location',
    timerText: '⌛ Timer',
    minuteSuffix: 'm',
    secondSuffix: 's',
    alarmTitle: '⏰ Times Up!',
    alarmText: 'Press Dismiss To Stop Alarm'
  },
  panelId: 'timer'
}

/*********************************************************
 * Main functions and event subscriptions
**********************************************************/

let timerLocation = 'bottom';
let timerSeconds = config.defaultTime ?? 0;
let ticker;
let state = 'stopped'; // stopped, running, paused
let alarmActive = false;


saveIcon()
  .then(() => savePanel('main'))


xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
  if (!event.WidgetId.startsWith(config.panelId)) return
  console.debug(event)
  const [_panelId, selection, option] = event.WidgetId.split('-');

  if (event.Type == 'clicked') {
    switch (selection) {
      case 'start': return startTimer();
      case 'stop': return stopTimer();
      case 'clear': return clearTimer();
      case 'pause': return pauseTimer();
      case 'presets': return savePanel('presets');
      case 'settings': return savePanel('settings');
      case 'main': return (state == 'stopped') ? savePanel('main') : savePanel(state)
    }
  } else if (event.Type == 'released') {
    switch (selection) {
      case 'increment': case 'decrement':
        resetWidget(event.WidgetId);
        setSeconds(selection, parseInt(event.Value));
        break;
      case 'location': return setTimerLocation(event.Value, event.WidgetId)
      case 'preset':
        if (option == 'minutesSeconds') {
          const [min, sec] = event.Value.split(':');
          timerSeconds = (parseInt(min) * 60) + parseInt(sec);
        } else if (option == 'minutes') {
          timerSeconds = (parseInt(event.Value) * 60);
        } else if (option == 'seconds') {
          timerSeconds = parseInt(event.Value);
        }
        savePanel('main');
        updateUI();
        break;
    }
  }
});


xapi.Event.UserInterface.Extensions.Panel.Clicked.on(event => {
  if (event.PanelId != config.panelId) return
  updateUI();
});

xapi.Event.UserInterface.Extensions.Event.PageClosed.on(event => {
  console.log('pageclose', event)
  if (event.PageId != config.panelId) return
  switch (state) {
    case 'stopped':
      timerSeconds = config?.defaultTime ?? 60;
      xapi.Command.UserInterface.Message.TextLine.Clear();
      xapi.Command.Video.Graphics.Clear({ Target: 'LocalOutput' });
      savePanel('main')
      break;
    case 'paused': case 'running': return savePanel(state)
  }
});

xapi.Event.UserInterface.Message.Alert.Cleared.on(() => {
  if (!alarmActive) return
  deactivateAlarm();
});


async function startTimer() {
  if (timerSeconds == 0) return
  console.log('Starting Timer');
  state = 'running';
  await savePanel('running');
  tick();
  ticker = setInterval(tick, 1000);
}

function clearTimer(){
  timerSeconds = 0;
  updateUI();
}

function stopTimer(finished = false) {
  console.log('Stopping Timer');
  clearInterval(ticker);
  if (finished && timerLocation == 'bottom') {
    xapi.Command.Video.Graphics.Clear({ Target: 'LocalOutput' });
  } else if(finished){
    xapi.Command.UserInterface.Message.TextLine.Clear();
  }
  timerSeconds = timerSeconds = config?.defaultTime ?? 60;;
  savePanel('main');
  state = 'stopped';
  if(!finished) updateUI();
}

function pauseTimer() {
  console.log('Pausing Timer');
  clearInterval(ticker);
  savePanel('paused');
  state = 'paused';
  updateUI();
}

function tick() {
  if (timerSeconds == 0) {
    stopTimer(true);
    xapi.Command.UserInterface.Extensions.Panel.Close();
    activateAlarm();
    return
  }
  timerSeconds = timerSeconds - 1;
  updateUI();
}


function activateAlarm() {
  alarmActive = true;
  const alertDuration = 8;

  xapi.Command.Audio.SoundsAndAlerts.Ringtone.Play({ Loop: 'On', RingTone: 'Connection' });
  setTimeout(deactivateAlarm, alertDuration * 1000);

  const alarmTitle = config?.localisation?.alarmTitle ?? '⏰ Times Up!';
  const alarmText = config?.localisation?.alarmText ?? 'Press Dismiss To Stop Alerm';

  xapi.Command.UserInterface.Message.Alert.Display({ Duration: alertDuration, Text: alarmText, Title: alarmTitle });
}

function deactivateAlarm() {
  alarmActive = false;
  xapi.Command.Audio.SoundsAndAlerts.Ringtone.Stop();
}

function resetWidget(WidgetId) {
  xapi.Command.UserInterface.Extensions.Widget.UnsetValue({ WidgetId });
}

function setTimerLocation(location, widgetId) {
  if (timerLocation == location) {
    timerLocation = 'none';
    resetWidget(widgetId)
  } else {
    timerLocation = location;
  }

  updateUI();
}


function displayText(location, text) {

  const locations = {
    'topLeft': { x: 1000, y: 1000 },
    'topCenter': { x: 5000, y: 1000 },
    'topRight': { x: 9000, y: 1000 },
    'middleLeft': { x: 1000, y: 5000 },
    'middleCenter': { x: 5000, y: 5000 },
    'middleRight': { x: 9000, y: 5000 },
    'bottomLeft': { x: 1000, y: 9000 },
    'bottomCenter': { x: 5000, y: 9000 },
    'bottomRight': { x: 9000, y: 9000 }
  };

  const result = text.replaceAll(/(\r\n|\r|\n)/g, '<br>');

  xapi.Command.UserInterface.Message.TextLine.Display({
    Text: result,
    X: locations?.[location].x ?? 9000,
    Y: locations?.[location].y ?? 1000
  });
}


function setSeconds(direction, seconds) {
  if (direction == 'increment') {
    timerSeconds = timerSeconds + seconds;
  } else if (timerSeconds <= seconds) {
    timerSeconds = 0;
  } else {
    timerSeconds = timerSeconds - seconds;
  }
  updateUI();
}


function createTimeStrings(seconds) {
  const minSuffix = config.localisation?.minuteSuffix ?? 'm';
  const secSuffix = config.localisation?.secondSuffix ?? 'm';
  let min = Math.floor(seconds / 60);
  if (min < 10) min = `0${min}${minSuffix}`; else min = `${min}${minSuffix}`;
  let sec = seconds % 60;
  if (sec < 10) sec = `0${sec}${secSuffix}`; else sec = `${sec}${secSuffix}`;
  return { min, sec }
}


function updateUI() {
  const time = createTimeStrings(timerSeconds)
  const timerText = config?.localisation?.timerText ?? '⌛ Timer';
  const stateString = (state == 'paused') ? ' ⏸' : ''
  const panelId = config.panelId;
  xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: `${time.min} ${time.sec}`, WidgetId: `${panelId}-timerText` })
    .catch(error => { })

  if (timerLocation == 'bottom') {
    xapi.Command.UserInterface.Message.TextLine.Clear();
    xapi.Command.Video.Graphics.Text.Display({ Target: 'LocalOutput', Text: `${timerText}: ${time.min} ${time.sec}${stateString}` });
  } else if (timerLocation == 'none') {
    xapi.Command.UserInterface.Message.TextLine.Clear();
    xapi.Command.Video.Graphics.Clear({ Target: 'LocalOutput' });
  } else {
    displayText(timerLocation, `${timerText}${stateString}<br>${time.min} ${time.sec}`);
    xapi.Command.Video.Graphics.Clear({ Target: 'LocalOutput' });
  }

}


function mapState(state) {
  const panelId = config.panelId;
  console.log('Mapping State:', state);
  const time = createTimeStrings(timerSeconds);

  switch (state) {
    case 'presets':
      console.debug('Creating Presets Page')

      function createButtonGroup(id, options, suffix = '') {
        if (!options) return ''
        const values = options.map(i => `<Value><Key>${i}</Key><Name>‎${i}${suffix}</Name></Value>`).join('')
        return `<Widget>
            <WidgetId>${panelId}-preset-${id}</WidgetId>
            <Type>GroupButton</Type>
            <Options>size=4;columns=4</Options>
            <ValueSpace>
              ${values}
            </ValueSpace>
          </Widget>`
      }

      const seconds = createButtonGroup('seconds', config?.presets?.seconds, 's');
      const minutes = createButtonGroup('minutes', config?.presets?.minutes, 'm');
      const minutesSeconds = createButtonGroup('minutesSeconds', config?.presets?.minutesSeconds);

      const groups = seconds + minutes + minutesSeconds;

      const options = groups + `<Widget><WidgetId>${panelId}-main</WidgetId>
            <Type>Button</Type><Options>size=1;icon=back</Options></Widget>`

      return `
        <Name>Select Preset</Name>
        <Row>
          ${options}
        </Row>`

    case 'running': case 'paused':
      console.debug('Creating Running/Paused Page')

      return `
      <Name>Timer</Name>
      <Row>
        <Widget>
          <WidgetId>${panelId}-timerText</WidgetId>
          <Name>${time.min} ${time.sec}</Name>
          <Type>Text</Type>
          <Options>size=4;fontSize=normal;align=center</Options>
        </Widget>
      </Row>
      <Row>
        <Widget>
          <WidgetId>${panelId}-settings</WidgetId>
          <Type>Button</Type>
          <Options>size=1;icon=list</Options>
        </Widget>
        <Widget>
          <WidgetId>${panelId}-${state == 'running' ? 'pause' : 'start'}</WidgetId>
          <Type>Button</Type>
          <Options>size=1;icon=${state == 'running' ? 'pause' : 'play'}</Options>
        </Widget>
        <Widget>
          <WidgetId>${panelId}-stop</WidgetId>
          <Type>Button</Type>
          <Options>size=1;icon=stop</Options>
        </Widget>
      </Row>
      <Options>hideRowNames=1</Options>`;

    case 'settings':
      console.debug('Creating Settings Page')

      const locations = ['topLeft', 'topCenter', 'topRight',
        'middleLeft', 'middleCenter', 'middleRight',
        'bottomLeft', 'bottomCenter', 'bottomRight',
        'bottom']

      const valueSpace = locations.map(location => {
        return `<Value><Key>${location}</Key><Name>‎</Name></Value>`
      }).join('')

      return `
        <Name>Location</Name>
        <Row>
          <Widget>
            <WidgetId>${panelId}-location</WidgetId>
            <Type>GroupButton</Type>
            <Options>size=4;columns=3</Options>
            <ValueSpace>
              ${valueSpace}
            </ValueSpace>
          </Widget>
        </Row>
        <Row>
          <Widget>
            <WidgetId>${panelId}-main</WidgetId>
            <Type>Button</Type>
            <Options>size=1;icon=back</Options>
          </Widget>
        </Row>`

    case 'main':

      const hasPresets = config?.presets?.seconds ||
        config?.presets?.minutes ||
        config?.presets?.minutesSeconds;

      const presetButton = hasPresets ? `<Widget>
          <WidgetId>${panelId}-presets</WidgetId>
          <Type>Button</Type>
          <Name>Presets</Name>
          <Options>size=2</Options>
        </Widget>` : '';

      return `<Name>Timer</Name>
      <Row>
        <Widget>
          <WidgetId>${panelId}-increment</WidgetId>
          <Type>GroupButton</Type>
          <Options>size=4;columns=4</Options>
          <ValueSpace>
            <Value>
              <Key>600</Key>
              <Name>+10m</Name>
            </Value>
            <Value>
              <Key>60</Key>
              <Name>+1m</Name>
            </Value>
            <Value>
              <Key>10</Key>
              <Name>+10s</Name>
            </Value>
            <Value>
              <Key>1</Key>
              <Name>+1s</Name>
            </Value>
          </ValueSpace>
        </Widget>
      </Row>
      <Row>
        <Widget>
          <WidgetId>${panelId}-timerText</WidgetId>
          <Name>${time.min} ${time.sec}</Name>
          <Type>Text</Type>
          <Options>size=4;fontSize=normal;align=center</Options>
        </Widget>
      </Row>
      <Row>
        <Widget>
          <WidgetId>${panelId}-decrement</WidgetId>
          <Type>GroupButton</Type>
          <Options>size=4;columns=4</Options>
          <ValueSpace>
            <Value>
              <Key>600</Key>
              <Name>-10m</Name>
            </Value>
            <Value>
              <Key>60</Key>
              <Name>-1m</Name>
            </Value>
            <Value>
              <Key>10</Key>
              <Name>-10s</Name>
            </Value>
            <Value>
              <Key>1</Key>
              <Name>-1s</Name>
            </Value>
          </ValueSpace>
        </Widget>
      </Row>
      <Row>
        <Widget>
          <WidgetId>${panelId}-clear</WidgetId>
          <Name>⟲</Name>
          <Type>Button</Type>
          <Options>size=1</Options>
        </Widget>
        ${presetButton}
      </Row>
      <Row>
        <Widget>
          <WidgetId>${panelId}-settings</WidgetId>
          <Type>Button</Type>
          <Options>size=1;icon=list</Options>
        </Widget>
        <Widget>
          <WidgetId>${panelId}-start</WidgetId>
          <Type>Button</Type>
          <Options>size=1;icon=play</Options>
        </Widget>
      </Row>
      <Options>hideRowNames=1</Options>`;

    default:
      console.log('No matching state:', state)

  }

}

/**
 * Saves UI Extension Panel to primary device for combine / divide control
 */
async function savePanel(state) {
  const panelLocation = 'HomeScreen';
  const panelId = config.panelId
  const buttonText = config?.localisation?.buttonText ?? 'Timer';
  const order = await panelOrder(panelId);
  const pageContent = mapState(state)
  const panel = `
  <Extensions>
    <Panel>
      <Location>${panelLocation}</Location>
      <Icon>Custom</Icon>
      <CustomIcon>
      <Id>${panelId}</Id>
      </CustomIcon>
      ${order}
      <Name>${buttonText}</Name>
      <ActivityType>Custom</ActivityType>
      <Page>
        ${pageContent}
        <PageId>${panelId}</PageId>
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel>
  </Extensions>`;

  await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId }, panel)
    .catch(e => console.log('Error saving panel: ' + e.message))

  if (state == 'main') {
    xapi.Command.UserInterface.Extensions.Widget.UnsetValue({ WidgetId: `${panelId}-timerText` })
  } else if (state == 'settings') {
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: timerLocation, WidgetId: `${panelId}-location` });
  }

}


/*********************************************************
 * Gets the current Panel Order if exiting Macro panel is present
 * to preserve the order in relation to other custom UI Extensions
 **********************************************************/
async function panelOrder(panelId) {
  const list = await xapi.Command.UserInterface.Extensions.List({ ActivityType: "Custom" });
  const panels = list?.Extensions?.Panel
  if (!panels) return ''
  const existingPanel = panels.find(panel => panel.PanelId == panelId)
  if (!existingPanel) return ''
  return `<Order>${existingPanel.Order}</Order>`
}

function saveIcon() {
  const icon = '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';
  return xapi.Command.UserInterface.Extensions.Icon.Upload({ Id: config.panelId }, icon).catch(error => { console.log('Uanble to save icon') })
}

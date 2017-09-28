/**
 * @providesModule YouTube
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  View,
  ViewPropTypes,
  StyleSheet,
  BackAndroid,
  BackHandler as BackHandlerModule,
  WebView,
} from 'react-native';

const BackHandler = BackHandlerModule || BackAndroid;

// fix https://github.com/facebook/react-native/issues/10865
const patchPostMessageJsCode = `(${String(() => {
  var originalPostMessage = window.postMessage;
  const patchedPostMessage = function(message, targetOrigin, transfer) {
    originalPostMessage(message, targetOrigin, transfer);
  };
  patchedPostMessage.toString = function() {
    return String(Object.hasOwnProperty).replace(
      'hasOwnProperty',
      'postMessage',
    );
  };
  window.postMessage = patchedPostMessage;
})})();`;

/* embeddedYouTubeHTML()
// Do not use comments or non-traditional js in the following code! it breaks things
// This is the html that the WebView loads. It loads it once and uses postMessage to communicate back with RN
// and injectJavascript to control the YouTube iframe api from RN.
*/
const embeddedYouTubeHTML = ({
  videoId,
  width,
  height,
  options: {
    autoplay,
    playsinline,
    showinfo,
    modestbranding,
    controls,
    rel,
    origin,
  },
}) =>
  `
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            html, body {
                margin: 0;
                background: black;
            }
        </style>
    </head>
    <body>


      <iframe id="youtube-player" type="text/html" width="${width}" height="${height}" enablejsapi=true
        src="http://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=${rel}&playsinline=${playsinline}&showinfo=${showinfo}&modestbranding=${modestbranding}&controls=${controls}&version=3&origin=${origin}"
        frameborder="0"></iframe>    

      <script type="text/javascript">
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";

        var firstScriptTag = document.getElementsByTagName('script')[0];
          
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        var player;
        var updateProgressTimer;


        function onYouTubeIframeAPIReady() {
          player = new YT.Player('youtube-player', {
            events: {
              'onReady': onPlayerReady,
              'onStateChange': onPlayerStateChange
            }
          });
        }

        function onPlayerReady(event) {
          window.postMessage(JSON.stringify({
              type: 'PLAYER_READY'
          }));

          if (${autoplay}) {
            player.playVideo();
          }
        }

        function onPlayerStateChange(event) {

          if (event.data === YT.PlayerState.PLAYING) {
            window.postMessage(JSON.stringify({
              type: 'STATE_CHANGE',
              payload: {
                state: 'playing',
              }
            }));            
            window.postMessage(JSON.stringify({
              type: 'PLAYING',
              payload: {
                duration: player.getDuration(),
                currentTime: player.getCurrentTime()
              }
            }));

            if (!updateProgressTimer) {
              updateProgressTimer = setInterval(function() {
                window.postMessage(JSON.stringify({
                  type: 'PLAYING',
                  payload: {
                    duration: player.getDuration(),
                    currentTime: player.getCurrentTime()
                  }
                }));                
              }, 1000);
            }
          }

          if (event.data === YT.PlayerState.ENDED) {
            if (updateProgressTimer) {
              clearInterval(updateProgressTimer);
              updateProgressTimer = undefined;
            }

            window.postMessage(JSON.stringify({
              type: 'STATE_CHANGE',
              payload: {
                state: 'ended',
              }
            })); 
          }

          if (event.data === YT.PlayerState.PAUSED) {
            if (updateProgressTimer) {
              clearInterval(updateProgressTimer);
              updateProgressTimer = undefined;
            }

            window.postMessage(JSON.stringify({
              type: 'STATE_CHANGE',
              payload: {
                state: 'paused',
              }
            })); 
          }
        }

        </script>    
    </body>
    </html>
`;

/*
//
// YouTubeWebView
//
// Caveats: Needs width/height defined. I would calculate width/height in parent
// component before even rendering this component. 
//
//  I wanted similar onProgress event/update as the iOS player so I use 1s interval
// to fire updates while video player is playing. 
//
*/
export class YouTubeWebView extends React.Component {
  static propTypes = {
    apiKey: PropTypes.string.isRequired,
    videoId: PropTypes.string,
    videoIds: PropTypes.arrayOf(PropTypes.string),
    playlistId: PropTypes.string,
    play: PropTypes.bool,
    loop: PropTypes.bool,
    fullscreen: PropTypes.bool,
    controls: PropTypes.oneOf([0, 1, 2]),
    showFullscreenButton: PropTypes.bool,
    onClick: PropTypes.func,
    onError: PropTypes.func,
    onReady: PropTypes.func,
    onChangeState: PropTypes.func,
    onChangeQuality: PropTypes.func,
    onChangeFullscreen: PropTypes.func,
    onProgress: PropTypes.func,
    origin: PropTypes.string.isRequired,
    style: (ViewPropTypes && ViewPropTypes.style) || View.propTypes.style,
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
  };

  static defaultProps = {
    showFullscreenButton: true,
  };

  constructor(props) {
    super(props);
    if (props.playsInline !== undefined) {
      throw new Error(
        'YouTube.android.js: `playsInline` prop was dropped. Please use `fullscreen`',
      );
    }

    this.state = {
      moduleMargin: StyleSheet.hairlineWidth * 2,
      fullscreen: props.fullscreen,
    };
  }

  componentWillMount() {
    BackHandler.addEventListener('hardwareBackPress', this._backPress);
  }

  componentWillReceiveProps(nextProps) {
    // Translate next `fullscreen` prop to state
    if (nextProps.fullscreen !== this.props.fullscreen) {
      this.setState({fullscreen: nextProps.fullscreen});
    }
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this._backPress);
  }

  // Danger! WiP
  _onShouldStartLoadWithRequest = navigator => {
    const url = navigator.url;
    const origin = this.props.origin;

    if (url.indexOf('data:text/html') !== -1) {
      if (this.timesLoaded < 1) {
        this.timesLoaded += 1;
        return true;
      }
      return false;
    }

    // xxx todo - when to call stopLoading? It seemed it was required on first android
    // device I tested but it stops loading on newer android.. hmmm
    // baseUrl uses origin and it fires off two calls to origin each initial load
    if (url === 'about:blank' || url === origin || url === `${origin}/`) {
      // console.log('hard stopping loadRequest');
      // this.webViewRef.stopLoading();
      return false;
    }

    if (this.props.onClick) {
      this.props.onClick({url});
    }
    this.webViewRef.stopLoading();
    return false;
  };

  _backPress = () => {
    if (this.state.fullscreen) {
      this.setState({fullscreen: false});
      return true;
    }
    return false;
  };

  _onError = event => {
    // xxx todo - not sure if event.nativeEvent is correct here
    console.warn('WebView error', event);
    if (this.props.onError) this.props.onError(event.nativeEvent);
  };

  // xxx todo - implement these 3 events

  // _onChangeState = event => {
  //    if (this.props.onChangeState) this.props.onChangeState(event.nativeEvent);
  // };

  /*_onChangeQuality = event => {
    if (this.props.onChangeQuality)
      this.props.onChangeQuality(event.nativeEvent);
  };

  _onChangeFullscreen = event => {
    const {isFullscreen} = event.nativeEvent;
    if (this.state.fullscreen !== isFullscreen)
      this.setState({fullscreen: isFullscreen});
    if (this.props.onChangeFullscreen)
      this.props.onChangeFullscreen(event.nativeEvent);
  };*/

  _onWebViewMessage = event => {
    const msg = JSON.parse(event.nativeEvent.data);

    switch (msg.type) {
      case 'PLAYING':
        // match iOS onProgress event, except we dont have the 'target' property, duration and currentTime only
        if (this.props.onProgress) {
          this.props.onProgress(msg.payload);
        }
        break;

      case 'PLAYER_READY':
        if (this.props.onReady) this.props.onReady(this.webViewRef);
        break;

      case 'STATE_CHANGE':
        if (this.props.onChangeState) this.props.onChangeState(msg.payload);
        break;

      default:
        console.warn('un-handled onMessage sent from WebView: ', msg);
        break;
    }
  };

  seekTo(seconds) {
    this.webViewRef.injectJavaScript(`player.seekTo(${seconds});`);
  }

  nextVideo() {
    this.webViewRef.injectJavaScript(`player.nextVideo();`);
  }

  previousVideo() {
    this.webViewRef.injectJavaScript(`player.previousVideo();`);
  }

  playVideoAt(index) {
    this.webViewRef.injectJavaScript(`player.playVideoAt(${index});`);
  }

  videosIndex() {
    console.warn(
      'videosIndex has not been implemented for Android using WebView',
    );
  }

  currentTime() {
    console.warn(
      'currentTime has not been implemented for Android using WebView, currentTime is returned in onProgress event.',
    );
  }

  shouldComponentUpdate(nextProps, nextState) {
    // if width isnt defined but is being defined, then lets allow update (WebView only renders after width/height defined)
    if (!this.props.width && nextProps.width) {
      return true;
    }

    // If height is already defined then that means we've already rendered WebView once. Ideally should only render it once.
    // shouldComponentUpate will return false unless setting initial width/height. Therefore we need to send message to webview to
    // resize internally.
    if (
      this.webViewRef &&
      (this.props.height !== nextProps.height ||
        this.props.width !== nextProps.width)
    ) {
      this.webViewRef.injectJavaScript(
        `player.setSize(${nextProps.width}, ${nextProps.height});`,
      );
      return false;
    }

    // if videoId or playlistId changes
    if (
      this.props.videoId !== nextProps.videoId // || this.props.playlistId !== nextProps.playlistId
    ) {
      this.webViewRef.injectJavaScript(
        `player.loadVideoById({ videoId: '${nextProps.videoId}'})`,
      );
      return false;
    }

    if (this.props.play !== nextProps.play && this.webViewRef) {
      // handle by posting message to webview
      if (nextProps.play) {
        this.webViewRef.injectJavaScript(`player.playVideo()`);
      } else {
        this.webViewRef.injectJavaScript(`player.pauseVideo()`);
      }
      // no need to update since we already handled
      return false;
    }

    // should double check that we aren't re-rendering unnnecessaryily
    return true;
  }

  render() {
    const {controls, width, height, origin, play, videoId} = this.props;

    return (
      <WebView
        ref={component => {
          this.webViewRef = component;
        }}
        {...this.props}
        origin={origin}
        key={`YouTubeWebViewPlayer`}
        style={{width, height}}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScript={patchPostMessageJsCode}
        scalesPageToFit
        startInLoadingState
        automaticallyAdjustContentInsets={false}
        onMessage={this._onWebViewMessage}
        geolocationEnabled={false}
        builtInZoomControls={false}
        source={{
          baseUrl: origin,
          html: embeddedYouTubeHTML({
            videoId,
            width,
            height,
            options: {
              autoplay: play,
              playsinline: true,
              showinfo: false,
              modestbranding: true,
              controls: 0,
              rel: 1,
              origin,
            },
          }),
        }}
        onNavigationStateChange={this._onShouldStartLoadWithRequest}
        onError={this._onError}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'black',
  },
  module: {
    flex: 1,
  },
});

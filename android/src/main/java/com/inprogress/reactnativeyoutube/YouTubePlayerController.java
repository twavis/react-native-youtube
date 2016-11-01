package com.inprogress.reactnativeyoutube;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.util.Log;

import com.google.android.youtube.player.YouTubeInitializationResult;
import com.google.android.youtube.player.YouTubePlayer;

import com.facebook.react.bridge.ReadableArray;

import java.util.List;
import java.util.Arrays;
import java.util.ArrayList;
import java.lang.StringBuilder;


public class YouTubePlayerController implements
        YouTubePlayer.OnInitializedListener, YouTubePlayer.PlayerStateChangeListener, YouTubePlayer.PlaybackEventListener {

    String videoId = null;
    List<String> videoIds = new ArrayList<String>();
    String playlist = null;

    YouTubePlayer mYouTubePlayer;
    YouTubeView mYouTubeView;

    private boolean isLoaded = false;
    private boolean play = false;
    private boolean hidden = false;
    private boolean related = false;
    private boolean modestBranding = false;
    private int controls = 1;
    private boolean showInfo = true;
    private boolean loop = false;
    private boolean playInline = false;

    public YouTubePlayerController(YouTubeView youTubeView) {
        this.mYouTubeView = youTubeView;
    }

    @Override
    public void onInitializationSuccess(YouTubePlayer.Provider provider, YouTubePlayer youTubePlayer, boolean wasRestored) {
        if (!wasRestored) {
            mYouTubePlayer = youTubePlayer;
            mYouTubePlayer.setPlayerStateChangeListener(this);
            mYouTubePlayer.setPlaybackEventListener(this);
            mYouTubePlayer.setFullscreen(true);
            updateControls();
            mYouTubeView.playerViewDidBecomeReady();
            setLoaded(true);
            if (isPlay()) {
                if (videoId != null) startVideo();
                else if (!videoIds.isEmpty()) startVideos();
                else if (playlist != null) startPlaylist();
                mYouTubePlayer.setFullscreen(false);
            }
        }
    }

    @Override
    public void onInitializationFailure(YouTubePlayer.Provider provider, YouTubeInitializationResult youTubeInitializationResult) {
        mYouTubeView.receivedError(youTubeInitializationResult.toString());
    }

    @Override
    public void onPlaying() {
        mYouTubeView.didChangeToState("playing");
    }

    @Override
    public void onPaused() {
        mYouTubeView.didChangeToState("paused");
    }

    @Override
    public void onStopped() {
        mYouTubeView.didChangeToState("stopped");
    }

    @Override
    public void onBuffering(boolean b) {
        if (b)
            mYouTubeView.didChangeToState("buffering");

        //Trick to remove when YouTube will patch it
        ProgressBar progressBar;
        try {
            // As of 2016-02-16, the ProgressBar is at position 0 -> 3 -> 2 in the view tree of the Youtube Player Fragment
            ViewGroup child1 = (ViewGroup)mYouTubeView.getChildAt(0);
            ViewGroup child2 = (ViewGroup)child1.getChildAt(3);
            progressBar = (ProgressBar)child2.getChildAt(2);
        } catch (Throwable t) {
            // As its position may change, we fallback to looking for it
            progressBar = findProgressBar(mYouTubeView);
        }

        int visibility = b ? View.VISIBLE : View.INVISIBLE;
        if (progressBar != null) {
            progressBar.setVisibility(visibility);
        }
    }

    private ProgressBar findProgressBar(View view) {
        if (view instanceof ProgressBar) {
            return (ProgressBar)view;
        } else if (view instanceof ViewGroup) {
            ViewGroup viewGroup = (ViewGroup)view;
            for (int i = 0; i < viewGroup.getChildCount(); i++) {
                ProgressBar res = findProgressBar(viewGroup.getChildAt(i));
                if (res != null) return res;
            }
        }
        return null;
    }

    @Override
    public void onSeekTo(int i) {

    }

    @Override
    public void onLoading() {
        mYouTubeView.didChangeToState("loading");
    }

    @Override
    public void onLoaded(String s) {

    }

    @Override
    public void onAdStarted() {
        mYouTubeView.didChangeToState("adStarted");
    }

    @Override
    public void onVideoStarted() {
        mYouTubeView.didChangeToState("videoStarted");
    }

    @Override
    public void onVideoEnded() {
        mYouTubeView.didChangeToState("ended");
        if (isLoop()) {
            startVideo();
        }
    }

    // TODO: Handle error of unplayable videos. Currently it shows a generic 400
    // Error and the whole player becomes inactive, event if only one of the videos
    // in a playlist is unplayable
    private void startVideo() {
        mYouTubePlayer.loadVideo(videoId);
    }

    private void startVideos() {
        mYouTubePlayer.loadVideos(videoIds);
    }

    private void startPlaylist() {
        mYouTubePlayer.loadPlaylist(playlist);
    }

    @Override
    public void onError(YouTubePlayer.ErrorReason errorReason) {
        mYouTubeView.receivedError(errorReason.toString());
    }

    public void seekTo(int second) {
        if (isLoaded()) {
            mYouTubePlayer.seekToMillis(second * 1000);
        }
    }

    public void nextVideo() {
        if (isLoaded()) {
            mYouTubePlayer.next();
        }
    }

    public void previousVideo() {
        if (isLoaded()) {
            mYouTubePlayer.previous();
        }
    }

    public void updateControls() {
        switch (controls) {
            case 0:
                mYouTubePlayer.setPlayerStyle(YouTubePlayer.PlayerStyle.CHROMELESS);
                break;
            case 1:
                mYouTubePlayer.setPlayerStyle(YouTubePlayer.PlayerStyle.DEFAULT);
                break;
            case 2:
                mYouTubePlayer.setPlayerStyle(YouTubePlayer.PlayerStyle.MINIMAL);
                break;
        }
    }


    /**
     * GETTER &SETTER
     **/

    public void setLoaded(boolean loaded) {
        isLoaded = loaded;
    }

    public boolean isLoaded() {
        return isLoaded;
    }

    /**
     * PROPS
     */

    public void setVideoId(String str) {
        videoId = str;
        if (isLoaded()) {
            startVideo();
        }
    }

    public void setVideoIds(ReadableArray arr) {
        if (arr != null) {
          videoIds.clear();
          for (int i = 1; i < arr.size(); i++) {
            videoIds.add(arr.getString(i));
          }
          // videoIds = Arrays.asList(str.split("\\s*,\\s*"));

          if (isLoaded()) {
            startVideos();
          }
        }
    }

    public void setPlaylist(String str) {
        playlist = str;
        if (isLoaded()) {
            startPlaylist();
        }
    }

    public void setPlay(boolean play) {
        this.play = play;
        if (mYouTubePlayer != null) {
            if (this.play && !mYouTubePlayer.isPlaying()) {
                mYouTubePlayer.play();
            } else if (!this.play && mYouTubePlayer.isPlaying()) {
                mYouTubePlayer.pause();
            }
        }
    }

    public void setLoop(boolean loop) {
        this.loop = loop;
    }

    public void setControls(Integer controls) {
        if (controls >= 0 && controls <= 2) {
            this.controls = Integer.valueOf(controls);
            if (isLoaded())
                updateControls();
        }
    }

    //TODO
    public void setHidden(boolean hidden) {
        this.hidden = hidden;
    }

    //TODO
    public void setShowInfo(boolean showInfo) {
        this.showInfo = showInfo;
    }

    //TODO
    public void setRelated(boolean related) {
        this.related = related;
    }

    //TODO
    public void setModestBranding(boolean modestBranding) {
        this.modestBranding = modestBranding;
    }

    //TODO
    public void setPlayInline(boolean playInline) {
        this.playInline = playInline;
    }

    public boolean isPlay() {
        return play;
    }

    public boolean isHidden() {
        return hidden;
    }

    public boolean isRelated() {
        return related;
    }

    public boolean isModestBranding() {
        return modestBranding;
    }

    public int getControls() {
        return controls;
    }

    public boolean isShowInfo() {
        return showInfo;
    }

    public boolean isLoop() {
        return loop;
    }

    public boolean isPlayInline() {
        return playInline;
    }

}
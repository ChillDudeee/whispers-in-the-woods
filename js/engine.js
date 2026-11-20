/** Story navigation. Scenes are defined entirely in JSON. */
export class StoryEngine {
  constructor(scenes) {
    if (!scenes || !scenes.start) throw new Error('The story needs a start scene.');
    this.scenes = scenes;
    this.currentId = 'start';
  }
  currentScene() { return this.scenes[this.currentId]; }
  goTo(id) {
    if (!Object.prototype.hasOwnProperty.call(this.scenes, id)) {
      throw new Error(`Story scene not found: ${id}`);
    }
    this.currentId = id;
    return this.currentScene();
  }
  restart() { return this.goTo('start'); }
}

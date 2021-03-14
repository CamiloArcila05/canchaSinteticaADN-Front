import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-toolbar',
  templateUrl: 'toolbar.component.html',
  styles: [`:host {
    display: block;
    height: 100px;
    padding: 20px;
  }
  img {
   width: 70%;
    height: 120px;
  }`]
})
export class ToolbarComponent implements OnInit {

  constructor() {
  }

  ngOnInit() {
  }

}

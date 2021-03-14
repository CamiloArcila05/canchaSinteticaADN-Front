import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {EditarCanchaComponent} from './editar-cancha.component';
import {CommonModule} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {RouterTestingModule} from '@angular/router/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ToastrModule} from 'ngx-toastr';
import {CanchaService} from '../../shared/service/cancha.service';
import {HttpService} from '@core-service/http.service';
import {of} from 'rxjs';
import {Cancha} from '../../shared/model/cancha';

describe('EditarCanchaComponent', () => {
  let component: EditarCanchaComponent;
  let fixture: ComponentFixture<EditarCanchaComponent>;
  let canchaService: CanchaService;


  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [EditarCanchaComponent],
      imports: [
        CommonModule,
        HttpClientModule,
        RouterTestingModule,
        ReactiveFormsModule,
        FormsModule,
        ToastrModule.forRoot()
      ],
      providers: [CanchaService, HttpService],
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditarCanchaComponent);
    component = fixture.componentInstance;
    canchaService = TestBed.inject(CanchaService);
    spyOn(canchaService, 'actualizar').and.returnValue(
      of(true)
    );
    localStorage.setItem('canchaSeleccionada', JSON.stringify(
      new Cancha(1, 'Cancha 1', 'Cancha 1', 'ACTIVO', 10000, 10000)));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('Actualizar Cancha', () => {
    component.canchaForm.controls.nombre.setValue('Cancha 1');
    expect(component.canchaForm.valid).toBeTruthy();
    component.actualizarCancha();
  });
});

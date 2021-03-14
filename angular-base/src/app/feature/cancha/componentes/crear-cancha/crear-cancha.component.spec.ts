import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearCanchaComponent } from './crear-cancha.component';
import {CommonModule} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {RouterTestingModule} from '@angular/router/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpService} from '@core-service/http.service';
import {CanchaService} from '../../shared/service/cancha.service';
import {of} from 'rxjs';
import {ToastrModule} from 'ngx-toastr';

describe('CrearCanchaComponent', () => {
  let component: CrearCanchaComponent;
  let fixture: ComponentFixture<CrearCanchaComponent>;
  let canchaService: CanchaService;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CrearCanchaComponent ],
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
    fixture = TestBed.createComponent(CrearCanchaComponent);
    component = fixture.componentInstance;
    canchaService = TestBed.inject(CanchaService);
    spyOn(canchaService, 'guardar').and.returnValue(
      of(true)
    );
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formulario es invalido cuando esta vacio', () => {
    expect(component.canchaForm.valid).toBeFalsy();
  });


  it('Registrando Cancha', () => {
    expect(component.canchaForm.valid).toBeFalsy();
    component.canchaForm.controls.nombre.setValue('Cancha 1');
    component.canchaForm.controls.descripcion.setValue('Cancha 1 Descripcion');
    component.canchaForm.controls.valorDia.setValue(1);
    component.canchaForm.controls.valorNoche.setValue(1);
    expect(component.canchaForm.valid).toBeTruthy();
    component.crearCancha();
  });


});
